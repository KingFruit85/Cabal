import { Context } from "@oak/oak";

export type WebSocketWithMetadata = WebSocket & {
  username: string;
  currentRoom: string;
};

export type WebSocketMessage = {
  event: string;
  [key: string]: any;
};

export interface IWebSocketManager {
  handleConnection(ctx: Context): Promise<void>;
  handleClientDisconnect(username: string): void;
  handleMessage(socket: WebSocketWithMetadata, message: string): void;
  broadcastToClient(username: string, message: WebSocketMessage): void;
}

export type MessageHandler = (socket: WebSocketWithMetadata, data: any) => void;
