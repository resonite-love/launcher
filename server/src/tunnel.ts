import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { Tunnel, ExtendedWebSocket } from './types';

// アクセスキー生成（6桁英大文字+数字、紛らわしい文字除外）
// 除外: 0/O (ゼロとオー), 1/I/L (イチとアイとエル)
function generateAccessKey(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class TunnelManager {
  private tunnels: Map<string, Tunnel> = new Map();
  private accessKeyToTunnelId: Map<string, string> = new Map();

  // トンネル作成
  createTunnel(hostWs: ExtendedWebSocket, target: string): Tunnel {
    const tunnelId = uuidv4();

    // ユニークなアクセスキーを生成
    let accessKey: string;
    do {
      accessKey = generateAccessKey();
    } while (this.accessKeyToTunnelId.has(accessKey));

    const tunnel: Tunnel = {
      id: tunnelId,
      accessKey,
      hostWs,
      target,
      clients: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.tunnels.set(tunnelId, tunnel);
    this.accessKeyToTunnelId.set(accessKey, tunnelId);

    // WebSocketに情報を付与
    hostWs.role = 'host';
    hostWs.tunnelId = tunnelId;

    console.log(`[Tunnel] Created: ${tunnelId} (key: ${accessKey})`);
    return tunnel;
  }

  // アクセスキーでトンネルを検索
  findByAccessKey(accessKey: string): Tunnel | undefined {
    const tunnelId = this.accessKeyToTunnelId.get(accessKey);
    if (!tunnelId) return undefined;
    return this.tunnels.get(tunnelId);
  }

  // トンネルIDで検索
  findById(tunnelId: string): Tunnel | undefined {
    return this.tunnels.get(tunnelId);
  }

  // クライアント追加
  addClient(tunnel: Tunnel, clientWs: ExtendedWebSocket): string {
    const clientId = uuidv4();
    tunnel.clients.set(clientId, clientWs);
    tunnel.lastActivity = new Date();

    // WebSocketに情報を付与
    clientWs.role = 'client';
    clientWs.tunnelId = tunnel.id;
    clientWs.clientId = clientId;

    console.log(`[Tunnel] Client joined: ${clientId} -> ${tunnel.id}`);
    return clientId;
  }

  // クライアント削除
  removeClient(tunnel: Tunnel, clientId: string): void {
    tunnel.clients.delete(clientId);
    tunnel.lastActivity = new Date();
    console.log(`[Tunnel] Client left: ${clientId} <- ${tunnel.id}`);
  }

  // トンネル削除
  deleteTunnel(tunnelId: string): void {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return;

    this.accessKeyToTunnelId.delete(tunnel.accessKey);
    this.tunnels.delete(tunnelId);
    console.log(`[Tunnel] Deleted: ${tunnelId}`);
  }

  // WebSocket切断時の処理
  handleDisconnect(ws: ExtendedWebSocket): { tunnel?: Tunnel; wasHost: boolean; clientId?: string } {
    if (!ws.tunnelId) {
      return { wasHost: false };
    }

    const tunnel = this.tunnels.get(ws.tunnelId);
    if (!tunnel) {
      return { wasHost: false };
    }

    if (ws.role === 'host') {
      // ホストが切断した場合、トンネルを削除
      this.deleteTunnel(ws.tunnelId);
      return { tunnel, wasHost: true };
    } else if (ws.role === 'client' && ws.clientId) {
      // クライアントが切断した場合
      this.removeClient(tunnel, ws.clientId);
      return { tunnel, wasHost: false, clientId: ws.clientId };
    }

    return { wasHost: false };
  }

  // 統計情報
  getStats(): { tunnelCount: number; totalClients: number } {
    let totalClients = 0;
    for (const tunnel of this.tunnels.values()) {
      totalClients += tunnel.clients.size;
    }
    return {
      tunnelCount: this.tunnels.size,
      totalClients,
    };
  }
}
