import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TunnelManager } from './tunnel';
import { MessageHandler } from './handlers';
import { ExtendedWebSocket } from './types';

const PORT = parseInt(process.env.PORT || '3000', 10);
const PING_INTERVAL = 30000; // 30秒
const PONG_TIMEOUT = 60000;  // 60秒

// 初期化
const tunnelManager = new TunnelManager();
const messageHandler = new MessageHandler(tunnelManager);

// CORS対応ヘッダー
function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// HTTPサーバー（ヘルスチェック・ステータス用）
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  setCorsHeaders(res);

  // OPTIONSリクエスト対応
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '/';

  // GET /health - ヘルスチェック
  if (url === '/health') {
    const stats = tunnelManager.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      tunnels: stats.tunnelCount,
      clients: stats.totalClients,
      uptime: process.uptime(),
    }));
    return;
  }

  // GET /stats - 詳細統計
  if (url === '/stats') {
    const stats = tunnelManager.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tunnels: stats.tunnelCount,
      clients: stats.totalClients,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
    }));
    return;
  }

  // GET / - ルート
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'ws-relay-server',
      version: '1.0.0',
      endpoints: {
        websocket: '/ws',
        health: '/health',
        stats: '/stats',
      },
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

// WebSocketサーバー
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  const extWs = ws as ExtendedWebSocket;
  extWs.isAlive = true;

  console.log('[WS] New connection');

  // Pongを受信したらisAliveをtrue
  ws.on('pong', () => {
    extWs.isAlive = true;
  });

  // メッセージ受信
  ws.on('message', (data: Buffer) => {
    try {
      const message = data.toString('utf-8');
      messageHandler.handleMessage(extWs, message);
    } catch (err) {
      console.error('[WS] Message handling error:', err);
    }
  });

  // 切断
  ws.on('close', () => {
    console.log('[WS] Connection closed');
    messageHandler.handleDisconnect(extWs);
  });

  // エラー
  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
  });
});

// Keep-alive: 定期的にpingを送信
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtendedWebSocket;

    if (!extWs.isAlive) {
      console.log('[WS] Terminating inactive connection');
      return ws.terminate();
    }

    extWs.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// サーバー起動
server.listen(PORT, () => {
  console.log(`[Server] WebSocket relay server running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');

  wss.clients.forEach((ws) => {
    ws.close();
  });

  wss.close(() => {
    server.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });
});
