import { Context } from "@oak/oak";
import { GitHubUser } from "./GitHubUser.ts";

export type WebSocketWithMetadata = WebSocket & {
  username: string;
  currentRoom: string;
  sessionId: string;
};

export type WebSocketMessage = {
  event: string;
  [key: string]: any;
};

export interface IWebSocketManager {
  handleConnection(
    ctx: Context,
    userDetails: GitHubUser,
    sessionId: string
  ): Promise<void>;
  handleClientDisconnect(username: string): void;
  handleMessage(socket: WebSocketWithMetadata, message: string): void;
  broadcastToClient(username: string, message: WebSocketMessage): void;
}

export type MessageHandler = (socket: WebSocketWithMetadata, data: any) => void;
