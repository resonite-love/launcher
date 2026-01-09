import { WebSocket } from 'ws';
import { TunnelManager } from './tunnel';
import {
  ExtendedWebSocket,
  ClientMessage,
  ServerMessage,
  ErrorCode,
  CreateTunnelMessage,
  JoinTunnelMessage,
  DataMessage,
} from './types';

// メッセージ送信ヘルパー
function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// エラー送信ヘルパー
function sendError(ws: WebSocket, code: ErrorCode, message: string): void {
  send(ws, { type: 'error', code, message });
}

export class MessageHandler {
  constructor(private tunnelManager: TunnelManager) {}

  // メッセージ処理
  handleMessage(ws: ExtendedWebSocket, rawData: string): void {
    let message: ClientMessage;

    try {
      message = JSON.parse(rawData);
    } catch {
      sendError(ws, 'INVALID_MESSAGE', 'Invalid JSON');
      return;
    }

    if (!message.type) {
      sendError(ws, 'INVALID_MESSAGE', 'Missing message type');
      return;
    }

    switch (message.type) {
      case 'create_tunnel':
        this.handleCreateTunnel(ws, message);
        break;
      case 'join_tunnel':
        this.handleJoinTunnel(ws, message);
        break;
      case 'data':
        this.handleData(ws, message);
        break;
      case 'close_tunnel':
        this.handleCloseTunnel(ws);
        break;
      case 'ping':
        send(ws, { type: 'pong' });
        break;
      default:
        sendError(ws, 'INVALID_MESSAGE', `Unknown message type: ${(message as any).type}`);
    }
  }

  // トンネル作成
  private handleCreateTunnel(ws: ExtendedWebSocket, message: CreateTunnelMessage): void {
    if (!message.target) {
      sendError(ws, 'INVALID_MESSAGE', 'Missing target address');
      return;
    }

    // 既にホストとして登録されている場合はエラー
    if (ws.role === 'host') {
      sendError(ws, 'INVALID_MESSAGE', 'Already hosting a tunnel');
      return;
    }

    const tunnel = this.tunnelManager.createTunnel(ws, message.target);

    send(ws, {
      type: 'tunnel_created',
      tunnel_id: tunnel.id,
      access_key: tunnel.accessKey,
    });
  }

  // トンネル参加
  private handleJoinTunnel(ws: ExtendedWebSocket, message: JoinTunnelMessage): void {
    if (!message.access_key) {
      sendError(ws, 'INVALID_MESSAGE', 'Missing access key');
      return;
    }

    // 既に何かに参加している場合はエラー
    if (ws.role) {
      sendError(ws, 'INVALID_MESSAGE', 'Already in a tunnel');
      return;
    }

    const tunnel = this.tunnelManager.findByAccessKey(message.access_key);
    if (!tunnel) {
      sendError(ws, 'INVALID_ACCESS_KEY', 'Access key not found or expired');
      return;
    }

    const clientId = this.tunnelManager.addClient(tunnel, ws);

    // クライアントに参加成功を通知
    send(ws, {
      type: 'tunnel_joined',
      tunnel_id: tunnel.id,
    });

    // ホストに新クライアントを通知
    send(tunnel.hostWs, {
      type: 'client_connected',
      client_id: clientId,
    });
  }

  // データ転送
  private handleData(ws: ExtendedWebSocket, message: DataMessage): void {
    if (!ws.tunnelId) {
      sendError(ws, 'INVALID_MESSAGE', 'Not in a tunnel');
      return;
    }

    const tunnel = this.tunnelManager.findById(ws.tunnelId);
    if (!tunnel) {
      sendError(ws, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
      return;
    }

    if (ws.role === 'host') {
      // ホストからクライアントへ
      if (!message.client_id) {
        sendError(ws, 'INVALID_MESSAGE', 'Missing client_id');
        return;
      }

      const clientWs = tunnel.clients.get(message.client_id);
      if (!clientWs) {
        // クライアントが見つからない場合は無視（既に切断済みの可能性）
        return;
      }

      send(clientWs, {
        type: 'data',
        payload: message.payload,
        binary: message.binary,
      });
    } else if (ws.role === 'client') {
      // クライアントからホストへ
      send(tunnel.hostWs, {
        type: 'data',
        client_id: ws.clientId,
        payload: message.payload,
        binary: message.binary,
      });
    }
  }

  // トンネルを閉じる
  private handleCloseTunnel(ws: ExtendedWebSocket): void {
    if (ws.role !== 'host' || !ws.tunnelId) {
      sendError(ws, 'INVALID_MESSAGE', 'Not a tunnel host');
      return;
    }

    const tunnel = this.tunnelManager.findById(ws.tunnelId);
    if (!tunnel) {
      return;
    }

    // 全クライアントに通知
    for (const clientWs of tunnel.clients.values()) {
      send(clientWs, {
        type: 'tunnel_closed',
        reason: 'host_closed',
      });
      clientWs.close();
    }

    this.tunnelManager.deleteTunnel(ws.tunnelId);
  }

  // 切断処理
  handleDisconnect(ws: ExtendedWebSocket): void {
    const result = this.tunnelManager.handleDisconnect(ws);

    if (result.wasHost && result.tunnel) {
      // ホストが切断した場合、全クライアントに通知
      for (const clientWs of result.tunnel.clients.values()) {
        send(clientWs, {
          type: 'tunnel_closed',
          reason: 'host_disconnected',
        });
        clientWs.close();
      }
    } else if (!result.wasHost && result.tunnel && result.clientId) {
      // クライアントが切断した場合、ホストに通知
      send(result.tunnel.hostWs, {
        type: 'client_disconnected',
        client_id: result.clientId,
        reason: 'connection_closed',
      });
    }
  }
}
