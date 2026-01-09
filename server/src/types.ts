import { WebSocket } from 'ws';

// === メッセージ型定義 ===

// ホスト → サーバー
export interface CreateTunnelMessage {
  type: 'create_tunnel';
  target: string;
}

// サーバー → ホスト
export interface TunnelCreatedMessage {
  type: 'tunnel_created';
  tunnel_id: string;
  access_key: string;
}

// クライアント → サーバー
export interface JoinTunnelMessage {
  type: 'join_tunnel';
  access_key: string;
}

// サーバー → クライアント
export interface TunnelJoinedMessage {
  type: 'tunnel_joined';
  tunnel_id: string;
}

// サーバー → ホスト
export interface ClientConnectedMessage {
  type: 'client_connected';
  client_id: string;
}

// サーバー → ホスト
export interface ClientDisconnectedMessage {
  type: 'client_disconnected';
  client_id: string;
  reason: 'connection_closed' | 'timeout' | 'error';
}

// 双方向
export interface DataMessage {
  type: 'data';
  client_id?: string;  // ホスト側では必須
  payload: string;
  binary: boolean;
}

// サーバー → クライアント
export interface TunnelClosedMessage {
  type: 'tunnel_closed';
  reason: 'host_disconnected' | 'host_closed';
}

// ホスト → サーバー
export interface CloseTunnelMessage {
  type: 'close_tunnel';
}

// サーバー → 両方
export interface ErrorMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
}

// 双方向
export interface PingMessage {
  type: 'ping';
}

export interface PongMessage {
  type: 'pong';
}

// エラーコード
export type ErrorCode =
  | 'INVALID_ACCESS_KEY'
  | 'TUNNEL_NOT_FOUND'
  | 'TUNNEL_FULL'
  | 'INVALID_MESSAGE'
  | 'INTERNAL_ERROR';

// 全メッセージ型
export type ClientMessage =
  | CreateTunnelMessage
  | JoinTunnelMessage
  | DataMessage
  | CloseTunnelMessage
  | PingMessage;

export type ServerMessage =
  | TunnelCreatedMessage
  | TunnelJoinedMessage
  | ClientConnectedMessage
  | ClientDisconnectedMessage
  | DataMessage
  | TunnelClosedMessage
  | ErrorMessage
  | PongMessage;

// === 内部状態 ===

export interface Tunnel {
  id: string;
  accessKey: string;
  hostWs: WebSocket;
  target: string;
  clients: Map<string, WebSocket>;
  createdAt: Date;
  lastActivity: Date;
}

// WebSocket拡張（接続情報を保持）
export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  role?: 'host' | 'client';
  tunnelId?: string;
  clientId?: string;
}
