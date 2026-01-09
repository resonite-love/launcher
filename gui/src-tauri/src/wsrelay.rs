use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::net::TcpListener;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message, WebSocketStream, MaybeTlsStream};
use tokio::net::TcpStream;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use tauri::{AppHandle, Manager};

const RELAY_SERVER_URL: &str = "wss://wsproxy.kokoa.dev/ws";

// フロントエンドに送信するイベント
#[derive(Clone, Serialize)]
pub struct ClientConnectedEvent {
    pub client_id: String,
}

#[derive(Clone, Serialize)]
pub struct ClientDisconnectedEvent {
    pub client_id: String,
}

#[derive(Clone, Serialize)]
pub struct HostDisconnectedEvent {
    pub reason: String,
}

#[derive(Clone, Serialize)]
pub struct ClientTunnelClosedEvent {
    pub reason: String,
}

// メッセージ型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum RelayMessage {
    #[serde(rename = "create_tunnel")]
    CreateTunnel { target: String },
    #[serde(rename = "tunnel_created")]
    TunnelCreated { tunnel_id: String, access_key: String },
    #[serde(rename = "join_tunnel")]
    JoinTunnel { access_key: String },
    #[serde(rename = "tunnel_joined")]
    TunnelJoined { tunnel_id: String },
    #[serde(rename = "client_connected")]
    ClientConnected { client_id: String },
    #[serde(rename = "client_disconnected")]
    ClientDisconnected { client_id: String, reason: String },
    #[serde(rename = "data")]
    Data {
        #[serde(skip_serializing_if = "Option::is_none")]
        client_id: Option<String>,
        payload: String,
        binary: bool,
    },
    #[serde(rename = "tunnel_closed")]
    TunnelClosed { reason: String },
    #[serde(rename = "close_tunnel")]
    CloseTunnel,
    #[serde(rename = "error")]
    Error { code: String, message: String },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
}

// ホスト状態
#[allow(dead_code)]
pub struct HostState {
    pub access_key: String,
    pub tunnel_id: String,
    pub connected_clients: Vec<String>,
    shutdown_tx: tokio::sync::broadcast::Sender<()>,
}

// クライアント状態
#[allow(dead_code)]
pub struct ClientState {
    pub local_address: String,
    pub tunnel_id: String,
    shutdown_tx: tokio::sync::broadcast::Sender<()>,
}

// グローバル状態
pub struct WsRelayState {
    pub host: Option<HostState>,
    pub client: Option<ClientState>,
}

impl Default for WsRelayState {
    fn default() -> Self {
        Self {
            host: None,
            client: None,
        }
    }
}

pub type SharedWsRelayState = Arc<RwLock<WsRelayState>>;

// レスポンス型
#[derive(Serialize)]
pub struct HostStartResult {
    pub access_key: String,
}

#[derive(Serialize)]
pub struct ClientConnectResult {
    pub local_address: String,
}

// ホスト開始
pub async fn start_host(
    state: SharedWsRelayState,
    target_address: String,
    app_handle: AppHandle,
) -> Result<HostStartResult, String> {
    // 既にホスト中か確認
    {
        let state_read = state.read().await;
        if state_read.host.is_some() {
            return Err("Already hosting".to_string());
        }
    }

    // 中継サーバーに接続
    let (ws_stream, _) = connect_async(RELAY_SERVER_URL)
        .await
        .map_err(|e| format!("Failed to connect to relay server: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // トンネル作成リクエスト
    let create_msg = RelayMessage::CreateTunnel {
        target: target_address.clone(),
    };
    let msg_str = serde_json::to_string(&create_msg)
        .map_err(|e| format!("Failed to serialize message: {}", e))?;

    write.send(Message::Text(msg_str))
        .await
        .map_err(|e| format!("Failed to send create_tunnel: {}", e))?;

    // レスポンス待機
    let response = read.next().await
        .ok_or("No response from server")?
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let response_text = match response {
        Message::Text(t) => t,
        _ => return Err("Unexpected response type".to_string()),
    };

    let parsed: RelayMessage = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let (tunnel_id, access_key) = match parsed {
        RelayMessage::TunnelCreated { tunnel_id, access_key } => (tunnel_id, access_key),
        RelayMessage::Error { code, message } => return Err(format!("{}: {}", code, message)),
        _ => return Err("Unexpected response".to_string()),
    };

    // シャットダウンチャンネル
    let (shutdown_tx, _) = tokio::sync::broadcast::channel::<()>(1);
    let shutdown_rx = shutdown_tx.subscribe();

    // 状態を保存
    {
        let mut state_write = state.write().await;
        state_write.host = Some(HostState {
            access_key: access_key.clone(),
            tunnel_id: tunnel_id.clone(),
            connected_clients: Vec::new(),
            shutdown_tx,
        });
    }

    // バックグラウンドタスクでメッセージ処理
    let state_clone = state.clone();
    let target_address_clone = target_address.clone();
    tokio::spawn(async move {
        host_message_loop(state_clone, write, read, target_address_clone, shutdown_rx, app_handle).await;
    });

    Ok(HostStartResult { access_key })
}

// ホスト停止
pub async fn stop_host(state: SharedWsRelayState) -> Result<(), String> {
    let mut state_write = state.write().await;

    if let Some(host) = state_write.host.take() {
        let _ = host.shutdown_tx.send(());
    }

    Ok(())
}

// クライアント接続
pub async fn connect_client(
    state: SharedWsRelayState,
    access_key: String,
    local_port: u16,
    app_handle: AppHandle,
) -> Result<ClientConnectResult, String> {
    // 既にクライアント中か確認
    {
        let state_read = state.read().await;
        if state_read.client.is_some() {
            return Err("Already connected as client".to_string());
        }
    }

    // 中継サーバーに接続
    let (ws_stream, _) = connect_async(RELAY_SERVER_URL)
        .await
        .map_err(|e| format!("Failed to connect to relay server: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // トンネル参加リクエスト
    let join_msg = RelayMessage::JoinTunnel { access_key };
    let msg_str = serde_json::to_string(&join_msg)
        .map_err(|e| format!("Failed to serialize message: {}", e))?;

    write.send(Message::Text(msg_str))
        .await
        .map_err(|e| format!("Failed to send join_tunnel: {}", e))?;

    // レスポンス待機
    let response = read.next().await
        .ok_or("No response from server")?
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let response_text = match response {
        Message::Text(t) => t,
        _ => return Err("Unexpected response type".to_string()),
    };

    let parsed: RelayMessage = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let tunnel_id = match parsed {
        RelayMessage::TunnelJoined { tunnel_id } => tunnel_id,
        RelayMessage::Error { code, message } => return Err(format!("{}: {}", code, message)),
        _ => return Err("Unexpected response".to_string()),
    };

    // ローカルWebSocketサーバーを起動
    let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))
        .await
        .map_err(|e| format!("Failed to bind local port: {}", e))?;

    let local_address = format!("ws://localhost:{}", local_port);

    // シャットダウンチャンネル
    let (shutdown_tx, _) = tokio::sync::broadcast::channel::<()>(1);
    let shutdown_rx = shutdown_tx.subscribe();

    // 状態を保存
    {
        let mut state_write = state.write().await;
        state_write.client = Some(ClientState {
            local_address: local_address.clone(),
            tunnel_id,
            shutdown_tx,
        });
    }

    // バックグラウンドタスクでクライアント処理
    let state_clone = state.clone();
    tokio::spawn(async move {
        client_message_loop(state_clone, write, read, listener, shutdown_rx, app_handle).await;
    });

    Ok(ClientConnectResult { local_address })
}

// クライアント切断
pub async fn disconnect_client(state: SharedWsRelayState) -> Result<(), String> {
    let mut state_write = state.write().await;

    if let Some(client) = state_write.client.take() {
        let _ = client.shutdown_tx.send(());
    }

    Ok(())
}

// ターゲットへの接続情報
struct TargetConnection {
    tx: tokio::sync::mpsc::Sender<Vec<u8>>,
}

// ホストのメッセージループ
async fn host_message_loop(
    state: SharedWsRelayState,
    write: futures_util::stream::SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    mut read: futures_util::stream::SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    target_address: String,
    mut shutdown_rx: tokio::sync::broadcast::Receiver<()>,
    app_handle: AppHandle,
) {
    // クライアントごとのターゲット接続を管理
    let target_connections: Arc<Mutex<HashMap<String, TargetConnection>>> =
        Arc::new(Mutex::new(HashMap::new()));

    // 中継サーバーへの送信用チャンネル
    let (relay_tx, mut relay_rx) = tokio::sync::mpsc::channel::<RelayMessage>(100);

    // 中継サーバーへの送信タスク
    let write = Arc::new(Mutex::new(write));
    let write_clone = write.clone();
    tokio::spawn(async move {
        while let Some(msg) = relay_rx.recv().await {
            if let Ok(msg_str) = serde_json::to_string(&msg) {
                let mut w = write_clone.lock().await;
                if w.send(Message::Text(msg_str)).await.is_err() {
                    break;
                }
            }
        }
    });

    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                // CloseTunnelを送信
                let _ = relay_tx.send(RelayMessage::CloseTunnel).await;
                break;
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<RelayMessage>(&text) {
                            match parsed {
                                RelayMessage::ClientConnected { client_id } => {
                                    // 新しいクライアント -> ターゲットWSに接続
                                    let target_conns = target_connections.clone();
                                    let target = target_address.clone();
                                    let cid = client_id.clone();
                                    let relay_tx_clone = relay_tx.clone();

                                    tokio::spawn(async move {
                                        if let Err(e) = connect_to_target(
                                            target_conns,
                                            target,
                                            cid,
                                            relay_tx_clone,
                                        ).await {
                                            eprintln!("Failed to connect to target: {}", e);
                                        }
                                    });

                                    // 状態更新
                                    let mut state_write = state.write().await;
                                    if let Some(ref mut host) = state_write.host {
                                        host.connected_clients.push(client_id.clone());
                                    }

                                    // フロントエンドに通知
                                    let _ = app_handle.emit_all("ws-relay-client-connected", ClientConnectedEvent {
                                        client_id,
                                    });
                                }
                                RelayMessage::ClientDisconnected { client_id, .. } => {
                                    // クライアント切断 -> ターゲット接続を閉じる
                                    let mut conns = target_connections.lock().await;
                                    conns.remove(&client_id);

                                    let mut state_write = state.write().await;
                                    if let Some(ref mut host) = state_write.host {
                                        host.connected_clients.retain(|id| id != &client_id);
                                    }

                                    // フロントエンドに通知
                                    let _ = app_handle.emit_all("ws-relay-client-disconnected", ClientDisconnectedEvent {
                                        client_id,
                                    });
                                }
                                RelayMessage::Data { client_id, payload, .. } => {
                                    // クライアントからのデータをターゲットに転送
                                    // payloadは常にBase64エンコードされている
                                    if let Some(client_id) = client_id {
                                        let conns = target_connections.lock().await;
                                        if let Some(conn) = conns.get(&client_id) {
                                            let data = BASE64.decode(&payload).unwrap_or_default();
                                            let _ = conn.tx.send(data).await;
                                        }
                                    }
                                }
                                RelayMessage::Ping => {
                                    let _ = relay_tx.send(RelayMessage::Pong).await;
                                }
                                _ => {}
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }

    // クリーンアップ
    let mut state_write = state.write().await;
    state_write.host = None;

    // フロントエンドに通知
    let _ = app_handle.emit_all("ws-relay-host-disconnected", HostDisconnectedEvent {
        reason: "Connection closed".to_string(),
    });
}

// ターゲットWSに接続
async fn connect_to_target(
    target_connections: Arc<Mutex<HashMap<String, TargetConnection>>>,
    target_address: String,
    client_id: String,
    relay_tx: tokio::sync::mpsc::Sender<RelayMessage>,
) -> Result<(), String> {
    let (ws_stream, _) = connect_async(&target_address)
        .await
        .map_err(|e| format!("Failed to connect to target: {}", e))?;

    let (mut target_write, mut target_read) = ws_stream.split();

    // ターゲットへの送信用チャンネル
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);

    // 接続を登録
    {
        let mut conns = target_connections.lock().await;
        conns.insert(client_id.clone(), TargetConnection { tx });
    }

    let cid = client_id.clone();
    let target_conns = target_connections.clone();

    // ターゲットへの送信タスク
    let cid_send = cid.clone();
    tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            // テキストとして送信を試みる
            if let Ok(text) = String::from_utf8(data.clone()) {
                if target_write.send(Message::Text(text)).await.is_err() {
                    break;
                }
            } else {
                if target_write.send(Message::Binary(data)).await.is_err() {
                    break;
                }
            }
        }
        // 接続を削除
        let mut conns = target_conns.lock().await;
        conns.remove(&cid_send);
    });

    // ターゲットからの受信タスク
    let cid_recv = cid.clone();
    tokio::spawn(async move {
        while let Some(Ok(msg)) = target_read.next().await {
            let (payload, binary) = match msg {
                Message::Text(t) => (BASE64.encode(t.as_bytes()), false),
                Message::Binary(b) => (BASE64.encode(&b), true),
                Message::Close(_) => break,
                _ => continue,
            };

            let data_msg = RelayMessage::Data {
                client_id: Some(cid_recv.clone()),
                payload,
                binary,
            };
            if relay_tx.send(data_msg).await.is_err() {
                break;
            }
        }
    });

    Ok(())
}

// ローカルクライアント接続情報
struct LocalClient {
    tx: tokio::sync::mpsc::Sender<Vec<u8>>,
}

// クライアントのメッセージループ
async fn client_message_loop(
    state: SharedWsRelayState,
    write: futures_util::stream::SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    mut read: futures_util::stream::SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    listener: TcpListener,
    mut shutdown_rx: tokio::sync::broadcast::Receiver<()>,
    app_handle: AppHandle,
) {
    // 現在のローカルクライアント（単一接続）
    let local_client: Arc<Mutex<Option<LocalClient>>> = Arc::new(Mutex::new(None));

    // 中継サーバーへの送信用チャンネル
    let (relay_tx, mut relay_rx) = tokio::sync::mpsc::channel::<RelayMessage>(100);

    // 中継サーバーへの送信タスク
    let write = Arc::new(Mutex::new(write));
    let write_clone = write.clone();
    tokio::spawn(async move {
        while let Some(msg) = relay_rx.recv().await {
            if let Ok(msg_str) = serde_json::to_string(&msg) {
                let mut w = write_clone.lock().await;
                if w.send(Message::Text(msg_str)).await.is_err() {
                    break;
                }
            }
        }
    });

    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                break;
            }
            accept_result = listener.accept() => {
                match accept_result {
                    Ok((stream, _)) => {
                        // WebSocketハンドシェイク
                        match tokio_tungstenite::accept_async(stream).await {
                            Ok(ws_stream) => {
                                let (mut local_write, mut local_read) = ws_stream.split();

                                // ローカルクライアントへの送信用チャンネル
                                let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);

                                // ローカルクライアントを登録
                                {
                                    let mut lc = local_client.lock().await;
                                    *lc = Some(LocalClient { tx });
                                }

                                // ローカルクライアントへの送信タスク
                                let lc_clone = local_client.clone();
                                tokio::spawn(async move {
                                    while let Some(data) = rx.recv().await {
                                        // テキストとして送信を試みる
                                        if let Ok(text) = String::from_utf8(data.clone()) {
                                            if local_write.send(Message::Text(text)).await.is_err() {
                                                break;
                                            }
                                        } else {
                                            if local_write.send(Message::Binary(data)).await.is_err() {
                                                break;
                                            }
                                        }
                                    }
                                    // 接続終了
                                    let mut lc = lc_clone.lock().await;
                                    *lc = None;
                                });

                                // ローカルクライアントからの受信タスク
                                let relay_tx_clone = relay_tx.clone();
                                let lc_clone2 = local_client.clone();
                                tokio::spawn(async move {
                                    while let Some(Ok(msg)) = local_read.next().await {
                                        let (payload, binary) = match msg {
                                            Message::Text(t) => (BASE64.encode(t.as_bytes()), false),
                                            Message::Binary(b) => (BASE64.encode(&b), true),
                                            Message::Close(_) => break,
                                            _ => continue,
                                        };

                                        let data_msg = RelayMessage::Data {
                                            client_id: None,
                                            payload,
                                            binary,
                                        };
                                        if relay_tx_clone.send(data_msg).await.is_err() {
                                            break;
                                        }
                                    }
                                    // 接続終了
                                    let mut lc = lc_clone2.lock().await;
                                    *lc = None;
                                });
                            }
                            Err(_) => {}
                        }
                    }
                    Err(_) => {}
                }
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<RelayMessage>(&text) {
                            match parsed {
                                RelayMessage::TunnelClosed { .. } => {
                                    // ループを抜けてクリーンアップでイベント発火
                                    break;
                                }
                                RelayMessage::Data { payload, .. } => {
                                    // 中継サーバーからのデータをローカルクライアントに転送
                                    // payloadは常にBase64エンコードされている
                                    let lc = local_client.lock().await;
                                    if let Some(ref client) = *lc {
                                        let data = BASE64.decode(&payload).unwrap_or_default();
                                        let _ = client.tx.send(data).await;
                                    }
                                }
                                RelayMessage::Ping => {
                                    let _ = relay_tx.send(RelayMessage::Pong).await;
                                }
                                _ => {}
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }

    // クリーンアップ
    let mut state_write = state.write().await;
    state_write.client = None;

    // フロントエンドに通知
    let _ = app_handle.emit_all("ws-relay-tunnel-closed", ClientTunnelClosedEvent {
        reason: "Connection closed".to_string(),
    });
}
