/**
 * WebSocket Relay テストクライアント
 *
 * Usage:
 *   node test-client.js host <target-ws-url>
 *   node test-client.js client <access-key> [local-port]
 *   node test-client.js echo-server [port]
 */

const WebSocket = require('ws');
const readline = require('readline');

const RELAY_SERVER = process.env.RELAY_SERVER || 'wss://wsproxy.kokoa.dev/ws';

// ホストモード: ローカルWSサーバーを公開
async function runHost(targetUrl) {
  console.log(`[Host] Connecting to relay server: ${RELAY_SERVER}`);
  console.log(`[Host] Target: ${targetUrl}`);

  const ws = new WebSocket(RELAY_SERVER);
  const localConnections = new Map(); // client_id -> WebSocket

  ws.on('open', () => {
    console.log('[Host] Connected to relay server');

    // トンネル作成
    ws.send(JSON.stringify({
      type: 'create_tunnel',
      target: targetUrl,
    }));
  });

  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[Host] Received:', msg.type);

    switch (msg.type) {
      case 'tunnel_created':
        console.log('');
        console.log('='.repeat(50));
        console.log(`[Host] Tunnel created!`);
        console.log(`[Host] Access Key: ${msg.access_key}`);
        console.log(`[Host] Tunnel ID: ${msg.tunnel_id}`);
        console.log('='.repeat(50));
        console.log('');
        break;

      case 'client_connected':
        console.log(`[Host] Client connected: ${msg.client_id}`);

        // ターゲットWSに接続
        try {
          const targetWs = new WebSocket(targetUrl);

          targetWs.on('open', () => {
            console.log(`[Host] Connected to target for client: ${msg.client_id}`);
            localConnections.set(msg.client_id, targetWs);
          });

          targetWs.on('message', (targetData) => {
            // ターゲットからのデータをクライアントに転送
            const isBinary = Buffer.isBuffer(targetData);
            const payload = isBinary
              ? targetData.toString('base64')
              : targetData.toString();

            ws.send(JSON.stringify({
              type: 'data',
              client_id: msg.client_id,
              payload,
              binary: isBinary,
            }));
            console.log(`[Host] Target -> Client(${msg.client_id.substring(0, 8)}): ${payload.substring(0, 50)}...`);
          });

          targetWs.on('close', () => {
            console.log(`[Host] Target connection closed for client: ${msg.client_id}`);
            localConnections.delete(msg.client_id);
          });

          targetWs.on('error', (err) => {
            console.error(`[Host] Target connection error: ${err.message}`);
          });
        } catch (err) {
          console.error(`[Host] Failed to connect to target: ${err.message}`);
        }
        break;

      case 'client_disconnected':
        console.log(`[Host] Client disconnected: ${msg.client_id} (${msg.reason})`);
        const targetWs = localConnections.get(msg.client_id);
        if (targetWs) {
          targetWs.close();
          localConnections.delete(msg.client_id);
        }
        break;

      case 'data':
        // クライアントからのデータをターゲットに転送
        const conn = localConnections.get(msg.client_id);
        if (conn && conn.readyState === WebSocket.OPEN) {
          const data = msg.binary
            ? Buffer.from(msg.payload, 'base64')
            : msg.payload;
          conn.send(data);
          console.log(`[Host] Client(${msg.client_id.substring(0, 8)}) -> Target: ${msg.payload.substring(0, 50)}...`);
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'error':
        console.error(`[Host] Error: ${msg.code} - ${msg.message}`);
        break;
    }
  });

  ws.on('close', () => {
    console.log('[Host] Disconnected from relay server');
    // すべてのローカル接続を閉じる
    for (const conn of localConnections.values()) {
      conn.close();
    }
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('[Host] WebSocket error:', err.message);
  });

  // Ctrl+C で終了
  process.on('SIGINT', () => {
    console.log('\n[Host] Shutting down...');
    ws.send(JSON.stringify({ type: 'close_tunnel' }));
    ws.close();
  });
}

// クライアントモード: アクセスキーで接続
async function runClient(accessKey, localPort = 33333) {
  console.log(`[Client] Connecting to relay server: ${RELAY_SERVER}`);
  console.log(`[Client] Access Key: ${accessKey}`);
  console.log(`[Client] Local Port: ${localPort}`);

  const ws = new WebSocket(RELAY_SERVER);
  let localServer = null;
  let localClient = null;

  ws.on('open', () => {
    console.log('[Client] Connected to relay server');

    // トンネル参加
    ws.send(JSON.stringify({
      type: 'join_tunnel',
      access_key: accessKey,
    }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[Client] Received:', msg.type);

    switch (msg.type) {
      case 'tunnel_joined':
        console.log('');
        console.log('='.repeat(50));
        console.log(`[Client] Joined tunnel: ${msg.tunnel_id}`);
        console.log(`[Client] Local WebSocket server starting on port ${localPort}`);
        console.log(`[Client] Connect to: ws://localhost:${localPort}`);
        console.log('='.repeat(50));
        console.log('');

        // ローカルWSサーバーを起動
        localServer = new WebSocket.Server({ port: localPort });

        localServer.on('connection', (clientWs) => {
          console.log('[Client] Local client connected');
          localClient = clientWs;

          clientWs.on('message', (clientData) => {
            // ローカルクライアントからのデータを中継サーバーに転送
            const isBinary = Buffer.isBuffer(clientData);
            const payload = isBinary
              ? clientData.toString('base64')
              : clientData.toString();

            ws.send(JSON.stringify({
              type: 'data',
              payload,
              binary: isBinary,
            }));
            console.log(`[Client] Local -> Relay: ${payload.substring(0, 50)}...`);
          });

          clientWs.on('close', () => {
            console.log('[Client] Local client disconnected');
            localClient = null;
          });
        });
        break;

      case 'data':
        // 中継サーバーからのデータをローカルクライアントに転送
        if (localClient && localClient.readyState === WebSocket.OPEN) {
          const data = msg.binary
            ? Buffer.from(msg.payload, 'base64')
            : msg.payload;
          localClient.send(data);
          console.log(`[Client] Relay -> Local: ${msg.payload.substring(0, 50)}...`);
        }
        break;

      case 'tunnel_closed':
        console.log(`[Client] Tunnel closed: ${msg.reason}`);
        if (localServer) {
          localServer.close();
        }
        process.exit(0);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'error':
        console.error(`[Client] Error: ${msg.code} - ${msg.message}`);
        break;
    }
  });

  ws.on('close', () => {
    console.log('[Client] Disconnected from relay server');
    if (localServer) {
      localServer.close();
    }
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('[Client] WebSocket error:', err.message);
  });

  // Ctrl+C で終了
  process.on('SIGINT', () => {
    console.log('\n[Client] Shutting down...');
    ws.close();
    if (localServer) {
      localServer.close();
    }
  });
}

// エコーサーバー: テスト用のシンプルなWSサーバー
function runEchoServer(port = 49994) {
  console.log(`[Echo] Starting echo server on port ${port}`);

  const wss = new WebSocket.Server({ port });

  wss.on('connection', (ws) => {
    console.log('[Echo] Client connected');

    ws.on('message', (data) => {
      const message = data.toString();
      console.log(`[Echo] Received: ${message}`);

      // エコーバック
      const response = `Echo: ${message}`;
      ws.send(response);
      console.log(`[Echo] Sent: ${response}`);
    });

    ws.on('close', () => {
      console.log('[Echo] Client disconnected');
    });

    // Welcome message
    ws.send('Welcome to echo server!');
  });

  console.log(`[Echo] WebSocket server running on ws://localhost:${port}`);
  console.log('[Echo] Press Ctrl+C to stop');

  process.on('SIGINT', () => {
    console.log('\n[Echo] Shutting down...');
    wss.close();
    process.exit(0);
  });
}

// メイン
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'host':
    if (!args[1]) {
      console.error('Usage: node test-client.js host <target-ws-url>');
      console.error('Example: node test-client.js host ws://localhost:49994');
      process.exit(1);
    }
    runHost(args[1]);
    break;

  case 'client':
    if (!args[1]) {
      console.error('Usage: node test-client.js client <access-key> [local-port]');
      console.error('Example: node test-client.js client AB3CD5 33333');
      process.exit(1);
    }
    runClient(args[1], parseInt(args[2]) || 33333);
    break;

  case 'echo-server':
    runEchoServer(parseInt(args[1]) || 49994);
    break;

  default:
    console.log('WebSocket Relay Test Client');
    console.log('');
    console.log('Usage:');
    console.log('  node test-client.js echo-server [port]    - Start a test echo server');
    console.log('  node test-client.js host <target-ws-url>  - Start as host');
    console.log('  node test-client.js client <key> [port]   - Connect as client');
    console.log('');
    console.log('Example workflow:');
    console.log('  1. Terminal 1: node test-client.js echo-server');
    console.log('  2. Terminal 2: node test-client.js host ws://localhost:49994');
    console.log('  3. Terminal 3: node test-client.js client <access-key>');
    console.log('  4. Terminal 4: wscat -c ws://localhost:33333');
    process.exit(1);
}
