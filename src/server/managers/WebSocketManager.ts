import { Context } from "@oak/oak";
import {
  IWebSocketManager,
  MessageHandler,
  WebSocketMessage,
  WebSocketWithMetadata,
} from "../types/WebSocket.ts";

export class WebSocketManager implements IWebSocketManager {
  private connectedClients = new Map<string, WebSocketWithMetadata>();
  private messageHandlers = new Map<string, MessageHandler>();

  constructor(
    private readonly onClientDisconnect: (username: string) => void,
    messageHandlers: Record<string, MessageHandler>
  ) {
    // Register message handlers
    Object.entries(messageHandlers).forEach(([event, handler]) => {
      this.messageHandlers.set(event, handler);
    });
  }

  public async handleConnection(ctx: Context): Promise<void> {
    try {
      const socket = (await ctx.upgrade()) as WebSocketWithMetadata;
      const username = ctx.request.url.searchParams.get("username");

      if (!username) {
        socket.close(1008, "Username is required");
        return;
      }

      if (this.connectedClients.has(username)) {
        socket.close(1008, `Username ${username} is already taken`);
        return;
      }

      // Initialize socket metadata
      socket.username = username;
      socket.currentRoom = "general"; // Default room

      // Set up socket event handlers
      this.setupSocketHandlers(socket);

      // Store the client connection
      this.connectedClients.set(username, socket);

      console.log(`Client connected: ${username}`);
    } catch (error) {
      console.error("Error in handleConnection:", error);
      throw error;
    }
  }

  private setupSocketHandlers(socket: WebSocketWithMetadata): void {
    socket.onopen = () => {
      this.handleSocketOpen(socket);
    };

    socket.onclose = () => {
      this.handleClientDisconnect(socket.username);
    };

    socket.onerror = (error) => {
      console.error(`WebSocket error for ${socket.username}:`, error);
    };

    socket.onmessage = (event) => {
      try {
        this.handleMessage(socket, event.data);
      } catch (error) {
        console.error("Error handling message:", error);
        this.sendErrorToClient(socket, "Error processing message");
      }
    };
  }

  private handleSocketOpen(socket: WebSocketWithMetadata): void {
    try {
      // Additional initialization if needed
      this.broadcast({
        event: "update-users",
        usernames: Array.from(this.connectedClients.keys()),
      });
      console.log(`Socket opened for ${socket.username}`);
    } catch (error) {
      console.error("Error in handleSocketOpen:", error);
    }
  }

  public handleClientDisconnect(username: string): void {
    console.log(`Client disconnecting: ${username}`);

    // Remove from connected clients
    this.connectedClients.delete(username);

    // Notify parent about disconnection
    this.onClientDisconnect(username);
  }

  public handleMessage(
    socket: WebSocketWithMetadata,
    rawMessage: string
  ): void {
    try {
      const data = JSON.parse(rawMessage);
      const handler = this.messageHandlers.get(data.event);

      if (handler) {
        handler(socket, data);
      } else {
        console.warn(`No handler found for event: ${data.event}`);
        this.sendErrorToClient(socket, `Unknown event: ${data.event}`);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
      this.sendErrorToClient(socket, "Invalid message format");
    }
  }

  public broadcastToClient(username: string, message: WebSocketMessage): void {
    const client = this.connectedClients.get(username);
    if (client?.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending to client ${username}:`, error);
      }
    }
  }

  public broadcast(message: WebSocketMessage): void {
    const messageString = JSON.stringify(message);
    for (const client of this.connectedClients.values()) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (error) {
          console.error(`Error broadcasting to ${client.username}:`, error);
        }
      }
    }
  }

  public broadcastToRoom(roomName: string, message: WebSocketMessage): void {
    const messageString = JSON.stringify(message);
    for (const client of this.connectedClients.values()) {
      if (
        client.currentRoom === roomName &&
        client.readyState === WebSocket.OPEN
      ) {
        try {
          client.send(messageString);
        } catch (error) {
          console.error(
            `Error broadcasting to room member ${client.username}:`,
            error
          );
        }
      }
    }
  }

  private sendErrorToClient(
    socket: WebSocketWithMetadata,
    message: string
  ): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            event: "error",
            message,
          })
        );
      } catch (error) {
        console.error("Error sending error message:", error);
      }
    }
  }

  public getConnectedClients(): Map<string, WebSocketWithMetadata> {
    return this.connectedClients;
  }

  public getClient(username: string): WebSocketWithMetadata | undefined {
    return this.connectedClients.get(username);
  }
}
