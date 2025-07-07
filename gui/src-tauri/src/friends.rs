use std::sync::Mutex;
use tauri::{State, Window};
use serde_json::Value;
use sha2::{Sha256, Digest};
use uuid::Uuid;
use base64::prelude::*;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast;

// Friends-related structures
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FriendStatus {
    pub user_id: String,
    pub online_status: String,
    pub world_name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ResoniteCredentials {
    pub identity: String,
    pub password: String,
}

pub struct FriendsConnection {
    pub is_connected: bool,
    pub session_token: Option<String>,
    pub user_id: Option<String>,
    pub machine_id: String,
    pub secret_machine_id: String,
}

impl Default for FriendsConnection {
    fn default() -> Self {
        Self {
            is_connected: false,
            session_token: None,
            user_id: None,
            machine_id: BASE64_STANDARD.encode(Uuid::new_v4().as_bytes()),
            secret_machine_id: Uuid::new_v4().to_string(),
        }
    }
}

// Helper function to generate SHA256 hash
fn sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

// Connect to Resonite friends API
#[tauri::command]
pub async fn connect_resonite_friends(
    credentials: ResoniteCredentials,
    state: State<'_, Mutex<crate::AppState>>,
    window: Window,
) -> Result<String, String> {
    println!("[FRIENDS DEBUG] Starting connection process");
    
    let (machine_id, secret_machine_id) = {
        let app_state = state.lock().unwrap();
        let machine_id = app_state.friends_connection.machine_id.clone();
        let secret_machine_id = app_state.friends_connection.secret_machine_id.clone();
        println!("[FRIENDS DEBUG] Machine ID: {}", machine_id);
        println!("[FRIENDS DEBUG] Secret Machine ID: {}", secret_machine_id);
        (machine_id, secret_machine_id)
    };
    
    // Create SHA256 hash of machine ID for UID
    let uid = sha256_hash(&machine_id);
    println!("[FRIENDS DEBUG] Generated UID: {}", uid);
    
    // Prepare login credentials
    let mut login_credentials = serde_json::json!({
        "ownerId": null,
        "email": null,
        "userName": null,
        "authentication": {
            "$type": "password",
            "password": credentials.password
        },
        "secretMachineId": secret_machine_id,
        "rememberMe": false
    });
    
    // Determine credential type
    if credentials.identity.starts_with("U-") {
        login_credentials["ownerId"] = serde_json::Value::String(credentials.identity.clone());
        println!("[FRIENDS DEBUG] Using owner ID: {}", credentials.identity);
    } else if credentials.identity.contains("@") {
        login_credentials["email"] = serde_json::Value::String(credentials.identity.clone());
        println!("[FRIENDS DEBUG] Using email: {}", credentials.identity);
    } else {
        login_credentials["userName"] = serde_json::Value::String(credentials.identity.clone());
        println!("[FRIENDS DEBUG] Using username: {}", credentials.identity);
    }
    
    println!("[FRIENDS DEBUG] Login credentials prepared: {}", serde_json::to_string_pretty(&login_credentials).unwrap_or_default());
    
    // Send login request
    let client = reqwest::Client::new();
    println!("[FRIENDS DEBUG] Sending login request to https://api.resonite.com/userSessions");
    
    let response = client
        .post("https://api.resonite.com/userSessions")
        .header("Content-Type", "application/json")
        .header("UID", &uid)
        .json(&login_credentials)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("Login request failed: {}", e);
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg
        })?;
    
    let status = response.status();
    println!("[FRIENDS DEBUG] Login response status: {}", status);
    
    if status != 200 {
        let error_text = response.text().await.unwrap_or_default();
        let error_msg = format!("Login failed: {} - {}", status, error_text);
        println!("[FRIENDS DEBUG] {}", error_msg);
        return Err(error_msg);
    }
    
    let login_result: Value = response.json().await
        .map_err(|e| {
            let error_msg = format!("Failed to parse login response: {}", e);
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg
        })?;
    
    println!("[FRIENDS DEBUG] Login result: {}", serde_json::to_string_pretty(&login_result).unwrap_or_default());
    
    let session_token = login_result["entity"]["token"].as_str()
        .ok_or_else(|| {
            let error_msg = "Failed to get session token from response";
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg.to_string()
        })?;
    let user_id = login_result["entity"]["userId"].as_str()
        .ok_or_else(|| {
            let error_msg = "Failed to get user ID from response";
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg.to_string()
        })?;
    
    println!("[FRIENDS DEBUG] Session token obtained: {}", session_token);
    println!("[FRIENDS DEBUG] User ID: {}", user_id);
    
    // Update state
    {
        let mut app_state = state.lock().unwrap();
        app_state.friends_connection.session_token = Some(session_token.to_string());
        app_state.friends_connection.user_id = Some(user_id.to_string());
        app_state.friends_connection.is_connected = true;
        println!("[FRIENDS DEBUG] State updated successfully");
    }
    
    // Notify frontend of successful connection
    let _ = window.emit("friends-connection-status", serde_json::json!({
        "status": "connected",
        "message": "Successfully connected to Resonite API"
    }));
    
    // Create shutdown channel for this connection
    let (shutdown_tx, shutdown_rx) = broadcast::channel(1);
    {
        let mut global_shutdown = SHUTDOWN_SENDER.lock().unwrap();
        *global_shutdown = Some(shutdown_tx);
    }
    
    // Start SignalR connection in background
    let window_clone = window.clone();
    let auth_header = format!("res {}:{}", user_id, session_token);
    println!("[FRIENDS DEBUG] Starting SignalR connection with auth: {}", auth_header);
    
    tokio::spawn(async move {
        if let Err(e) = start_signalr_connection(auth_header, window_clone, shutdown_rx).await {
            println!("[FRIENDS DEBUG] SignalR connection failed: {}", e);
            let _ = window.emit("friends-connection-status", serde_json::json!({
                "status": "error",
                "message": format!("SignalR connection failed: {}", e)
            }));
        }
    });
    
    Ok("Connected to Resonite friends API".to_string())
}

// Session cache for world information
static SESSION_CACHE: std::sync::Mutex<Vec<serde_json::Value>> = std::sync::Mutex::new(Vec::new());

// Global shutdown channel for stopping connections
static SHUTDOWN_SENDER: std::sync::Mutex<Option<broadcast::Sender<()>>> = std::sync::Mutex::new(None);

// Update session cache periodically
async fn update_session_cache_loop(_window: Window, mut shutdown_rx: broadcast::Receiver<()>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
    
    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                println!("[FRIENDS DEBUG] Session cache update loop shutting down");
                break;
            }
            _ = interval.tick() => {
                if let Err(e) = update_session_cache().await {
                    println!("[FRIENDS DEBUG] Failed to update session cache: {}", e);
                    continue;
                }
                
                println!("[FRIENDS DEBUG] Session cache updated successfully");
            }
        }
    }
}

// Update session cache from API
async fn update_session_cache() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("[FRIENDS DEBUG] Updating session cache");
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.resonite.com/sessions?includeEmptyHeadless=false&minActiveUsers=1")
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("Session API returned: {}", response.status()).into());
    }
    
    let sessions: Vec<serde_json::Value> = response.json().await?;
    println!("[FRIENDS DEBUG] Retrieved {} sessions", sessions.len());
    
    {
        let mut cache = SESSION_CACHE.lock().unwrap();
        *cache = sessions;
    }
    
    Ok(())
}

// Get world name from session cache
fn get_world_name_from_cache(user_id: &str) -> Option<String> {
    let cache = SESSION_CACHE.lock().unwrap();
    
    for session in cache.iter() {
        if let Some(users) = session["sessionUsers"].as_array() {
            for user in users {
                if let (Some(uid), Some(is_present)) = (
                    user["userID"].as_str(),
                    user["isPresent"].as_bool(),
                ) {
                    if uid == user_id && is_present {
                        if let Some(world_name) = session["name"].as_str() {
                            println!("[FRIENDS DEBUG] Found world for {}: {}", user_id, world_name);
                            return Some(world_name.to_string());
                        }
                    }
                }
            }
        }
    }
    
    println!("[FRIENDS DEBUG] No world found for user: {}", user_id);
    None
}

// Start SignalR connection for real-time updates using WebSocket
async fn start_signalr_connection(
    auth_header: String,
    window: Window,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("[FRIENDS DEBUG] Attempting to connect to SignalR hub with auth: {}", auth_header);
    
    // Step 1: Perform SignalR negotiation via HTTP (like JavaScript @microsoft/signalr does)
    let negotiate_result = signalr_negotiate(&auth_header).await?;
    println!("[FRIENDS DEBUG] SignalR negotiation completed: {:?}", negotiate_result);
    
    // Step 2: Connect to WebSocket with connection token
    let ws_url = format!("wss://api.resonite.com/hub?id={}", negotiate_result.connection_token);
    println!("[FRIENDS DEBUG] Connecting to WebSocket: wss://api.resonite.com/hub?id=...");
    
    let (ws_stream, _response) = connect_async(&ws_url).await?;
    println!("[FRIENDS DEBUG] WebSocket connection established");
    
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    
    // Track invocation ID for SignalR protocol compliance
    let mut invocation_id = 1;
    
    // Send SignalR handshake message with authentication
    let handshake_msg = serde_json::json!({
        "protocol": "json",
        "version": 1
    });
    let handshake_text = format!("{}\u{1e}", serde_json::to_string(&handshake_msg)?);
    println!("[FRIENDS DEBUG] Sending handshake: {}", handshake_text.trim_end_matches('\u{1e}'));
    ws_sender.send(Message::Text(handshake_text)).await?;
    
    
    // Handle incoming messages in a separate task
    let window_clone = window.clone();
    let mut receive_task = tokio::spawn(async move {
        while let Some(message) = ws_receiver.next().await {
            match message {
                Ok(Message::Text(text)) => {
                    println!("[FRIENDS DEBUG] Received message: {}", text);
                    handle_signalr_message(&text, &window_clone).await;
                },
                Ok(Message::Close(_)) => {
                    println!("[FRIENDS DEBUG] WebSocket connection closed");
                    break;
                },
                Err(e) => {
                    println!("[FRIENDS DEBUG] WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });
    
    // Wait for handshake response
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    // Send InitializeStatus invocation
    let init_status_msg = serde_json::json!({
        "type": 1,
        "invocationId": invocation_id.to_string(),
        "target": "InitializeStatus",
        "arguments": []
    });
    let init_status_text = format!("{}\u{1e}", serde_json::to_string(&init_status_msg)?);
    println!("[FRIENDS DEBUG] Sending InitializeStatus: {}", init_status_text.trim_end_matches('\u{1e}'));
    ws_sender.send(Message::Text(init_status_text)).await?;
    invocation_id += 1;
    
    // Wait a moment for initialization
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    // Send RequestStatus invocation
    let request_status_msg = serde_json::json!({
        "type": 1,
        "invocationId": invocation_id.to_string(),
        "target": "RequestStatus",
        "arguments": [null, false]
    });
    let request_status_text = format!("{}\u{1e}", serde_json::to_string(&request_status_msg)?);
    println!("[FRIENDS DEBUG] Sending RequestStatus: {}", request_status_text.trim_end_matches('\u{1e}'));
    ws_sender.send(Message::Text(request_status_text)).await?;
    invocation_id += 1;
    
    println!("[FRIENDS DEBUG] SignalR connection is now active, waiting for messages...");
    
    // Notify frontend that SignalR is fully connected
    let _ = window.emit("friends-connection-status", serde_json::json!({
        "status": "signalr_ready",
        "message": "SignalR connection established and ready for messages"
    }));
    
    // Start session cache update loop now that SignalR is connected
    let window_for_sessions = window.clone();
    let shutdown_rx_clone = shutdown_rx.resubscribe();
    tokio::spawn(async move {
        update_session_cache_loop(window_for_sessions, shutdown_rx_clone).await;
    });
    
    // Keep the connection alive and monitor it
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                println!("[FRIENDS DEBUG] Shutdown signal received, closing connection");
                let _ = ws_sender.send(Message::Close(None)).await;
                break;
            }
            _ = interval.tick() => {
                // Send ping to keep connection alive
                let ping_msg = serde_json::json!({"type": 6});
                let ping_text = format!("{}\u{1e}", serde_json::to_string(&ping_msg)?);
                if let Err(e) = ws_sender.send(Message::Text(ping_text)).await {
                    println!("[FRIENDS DEBUG] Failed to send ping: {}", e);
                    break;
                }
                println!("[FRIENDS DEBUG] Sent ping to keep connection alive");
            }
            result = &mut receive_task => {
                match result {
                    Ok(_) => println!("[FRIENDS DEBUG] Receive task completed"),
                    Err(e) => println!("[FRIENDS DEBUG] Receive task error: {}", e),
                }
                break;
            }
        }
    }
    
    println!("[FRIENDS DEBUG] SignalR connection ended");
    Ok(())
}

// Handle incoming SignalR messages
async fn handle_signalr_message(text: &str, window: &Window) {
    // SignalR messages are separated by ASCII character 0x1E
    for message_part in text.split('\u{1e}') {
        if message_part.trim().is_empty() {
            continue;
        }
        
        println!("[FRIENDS DEBUG] Processing message part: {}", message_part);
        
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(message_part) {
            let msg_type = msg["type"].as_u64().unwrap_or(0);
            
            match msg_type {
                1 => {
                    // Invocation message (type 1)
                    let target = msg["target"].as_str().unwrap_or("");
                    let arguments = msg["arguments"].as_array();
                    
                    println!("[FRIENDS DEBUG] Received invocation: {}", target);
                    
                    match target {
                        "ReceiveStatusUpdate" => {
                            println!("[FRIENDS DEBUG] Processing ReceiveStatusUpdate message");
                            if let Some(args) = arguments {
                                if let Some(status_data) = args.get(0) {
                                    handle_status_update(status_data, window).await;
                                } else {
                                    println!("[FRIENDS DEBUG] ReceiveStatusUpdate: No status data in arguments");
                                }
                            } else {
                                println!("[FRIENDS DEBUG] ReceiveStatusUpdate: No arguments provided");
                            }
                        },
                        "ReceiveSessionUpdate" => {
                            if let Some(args) = arguments {
                                if let Some(session_data) = args.get(0) {
                                    handle_session_update(session_data).await;
                                }
                            }
                        },
                        "RemoveSession" => {
                            if let Some(args) = arguments {
                                if let Some(session_id) = args.get(0).and_then(|v| v.as_str()) {
                                    handle_remove_session(session_id).await;
                                }
                            }
                        },
                        "SendStatusToUser" => {
                            // Handle SendStatusToUser message if needed
                            println!("[FRIENDS DEBUG] Received SendStatusToUser message");
                            if let Some(args) = arguments {
                                println!("[FRIENDS DEBUG] SendStatusToUser arguments: {:?}", args);
                            }
                        },
                        "debug" => {
                            // Handle debug messages
                            println!("[FRIENDS DEBUG] Received debug message");
                            if let Some(args) = arguments {
                                println!("[FRIENDS DEBUG] Debug arguments: {:?}", args);
                            }
                        },
                        _ => {
                            println!("[FRIENDS DEBUG] Unknown invocation target: {}", target);
                        }
                    }
                },
                2 => {
                    // Completion message
                    println!("[FRIENDS DEBUG] Received completion message");
                },
                3 => {
                    // Stream Item message
                    println!("[FRIENDS DEBUG] Received stream item message");
                },
                6 => {
                    // Ping message
                    println!("[FRIENDS DEBUG] Received ping");
                },
                7 => {
                    // Close message
                    println!("[FRIENDS DEBUG] Received close message");
                },
                _ => {
                    println!("[FRIENDS DEBUG] Unknown message type: {}", msg_type);
                }
            }
        } else {
            println!("[FRIENDS DEBUG] Failed to parse message: {}", message_part);
        }
    }
}

// Handle ReceiveStatusUpdate messages
async fn handle_status_update(status_data: &serde_json::Value, window: &Window) {
    println!("[FRIENDS DEBUG] Status data: {}", serde_json::to_string_pretty(status_data).unwrap_or_default());
    
    let user_id = status_data["userId"].as_str().unwrap_or("");
    let online_status = status_data["onlineStatus"].as_str().unwrap_or("Offline");
    
    println!("[FRIENDS DEBUG] User: {}, Status: {}", user_id, online_status);
    
    // Get world name from session cache
    let world_name = if online_status == "Online" {
        get_world_name_from_cache(user_id)
    } else {
        None
    };
    
    let friend_status = FriendStatus {
        user_id: user_id.replace("U-", ""),
        online_status: online_status.to_string(),
        world_name,
    };
    
    println!("[FRIENDS DEBUG] Emitting friend status: {:?}", friend_status);
    let _ = window.emit("friend-status-update", &friend_status);
}

// Handle ReceiveSessionUpdate messages
async fn handle_session_update(session_data: &serde_json::Value) {
    let session_id = session_data["sessionId"].as_str().unwrap_or("");
    
    // Update session cache immediately
    {
        let mut cache = SESSION_CACHE.lock().unwrap();
        // Check if session already exists in cache
        if let Some(pos) = cache.iter().position(|s| s["sessionId"].as_str().unwrap_or("") == session_id) {
            cache[pos] = session_data.clone();
        } else {
            cache.push(session_data.clone());
        }
    }
}

// Handle RemoveSession messages
async fn handle_remove_session(session_id: &str) {
    println!("[FRIENDS DEBUG] Removing session: {}", session_id);
    
    // Remove from session cache
    {
        let mut cache = SESSION_CACHE.lock().unwrap();
        cache.retain(|s| s["sessionId"].as_str().unwrap_or("") != session_id);
        println!("[FRIENDS DEBUG] Session removed. Total sessions: {}", cache.len());
    }
}

// Disconnect from Resonite friends API
#[tauri::command]
pub async fn disconnect_resonite_friends(
    state: State<'_, Mutex<crate::AppState>>,
    window: Window,
) -> Result<String, String> {
    println!("[FRIENDS DEBUG] Disconnecting from Resonite API");
    
    // Send shutdown signal to all background tasks
    {
        let mut global_shutdown = SHUTDOWN_SENDER.lock().unwrap();
        if let Some(sender) = global_shutdown.take() {
            let _ = sender.send(());
            println!("[FRIENDS DEBUG] Shutdown signal sent to background tasks");
        }
    }
    
    let logout_info = {
        let app_state = state.lock().unwrap();
        (
            app_state.friends_connection.user_id.clone(),
            app_state.friends_connection.session_token.clone(),
        )
    };
    
    if let (Some(user_id), Some(session_token)) = logout_info {
        println!("[FRIENDS DEBUG] Sending logout request for user: {}", user_id);
        // Send logout request
        let client = reqwest::Client::new();
        let logout_url = format!("https://api.resonite.com/userSessions/{}/{}", user_id, session_token);
        let response = client.delete(&logout_url).send().await;
        println!("[FRIENDS DEBUG] Logout response: {:?}", response);
    }
    
    // Reset connection state
    {
        let mut app_state = state.lock().unwrap();
        app_state.friends_connection = FriendsConnection::default();
        println!("[FRIENDS DEBUG] Connection state reset");
    }
    
    // Notify frontend of disconnection
    let _ = window.emit("friends-connection-status", serde_json::json!({
        "status": "disconnected",
        "message": "Disconnected from Resonite friends API"
    }));
    
    Ok("Disconnected from Resonite friends API".to_string())
}

// Refresh friends status
#[tauri::command]
pub async fn refresh_friends_status(
    state: State<'_, Mutex<crate::AppState>>,
) -> Result<String, String> {
    println!("[FRIENDS DEBUG] Refreshing friends status");
    
    let (_user_id, _session_token, _uid) = {
        let app_state = state.lock().unwrap();
        let connection = &app_state.friends_connection;
        
        if !connection.is_connected {
            println!("[FRIENDS DEBUG] Not connected to Resonite API");
            return Err("Not connected to Resonite API".to_string());
        }
        
        let uid = sha256_hash(&connection.machine_id);
        (
            connection.user_id.clone().unwrap(),
            connection.session_token.clone().unwrap(),
            uid,
        )
    };
    
    // Request status update from SignalR hub
    // In a real implementation, this would send a SignalR message
    // For now, we'll just return success
    println!("[FRIENDS DEBUG] Friends status refresh requested");
    Ok("Friends status refresh requested".to_string())
}

// SignalR negotiation structure
#[derive(serde::Deserialize, Debug)]
struct SignalRNegotiateResponse {
    #[serde(rename = "connectionToken")]
    connection_token: String,
    #[serde(rename = "connectionId")]
    connection_id: String,
    #[serde(rename = "availableTransports")]
    available_transports: Vec<serde_json::Value>,
}

// Perform SignalR negotiation via HTTP (replicating @microsoft/signalr behavior)
async fn signalr_negotiate(auth_header: &str) -> Result<SignalRNegotiateResponse, Box<dyn std::error::Error + Send + Sync>> {
    println!("[FRIENDS DEBUG] Performing SignalR negotiation");
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.resonite.com/hub/negotiate?negotiateVersion=1")
        .header("Authorization", auth_header)
        .header("Content-Type", "application/json")
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("Negotiation failed: {}", response.status()).into());
    }
    
    let negotiate_response: SignalRNegotiateResponse = response.json().await?;
    println!("[FRIENDS DEBUG] Negotiation successful, connection token: {}", &negotiate_response.connection_token[..std::cmp::min(20, negotiate_response.connection_token.len())]);
    
    Ok(negotiate_response)
}