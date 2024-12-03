import { Context } from "@oak/oak";
import { WebSocketManager } from "./managers/WebSocketManager.ts";
import { MessageManager } from "./managers/MessageManager.ts";
import { BroadcastManager } from "./managers/BroadcastManager.ts";
import { CabalManager } from "./managers/CabalManager.ts";
import { WebSocketWithMetadata } from "./types/WebSocket.ts";
import { CabalEvent } from "./types/Room.ts";
import { MessageEvent } from "./types/Message.ts";
import {
  CreateCabalData,
  DeleteMessageData,
  EditMessageData,
  JoinCabalData,
  LeaveCabalData,
  SendMessageData,
} from "./types/Message.ts";

export default class ChatServer {
  private webSocketManager: WebSocketManager;
  private messageManager: MessageManager;
  private cabalManager: CabalManager;
  private broadcastManager: BroadcastManager;

  constructor() {
    // Initialize managers with their event handlers
    this.messageManager = new MessageManager((event) =>
      this.handleMessageEvent(event)
    );

    this.cabalManager = new CabalManager(
      (event) => this.handleCabalEvent(event),
      this.messageManager
    );

    this.webSocketManager = new WebSocketManager(
      (username) => this.handleClientDisconnect(username),
      this.getMessageHandlers()
    );

    this.broadcastManager = new BroadcastManager(
      () => this.webSocketManager.getConnectedClients(),
      this.cabalManager
    );
  }

  public async handleConnection(ctx: Context): Promise<void> {
    await this.webSocketManager.handleConnection(ctx);
  }

  private getMessageHandlers() {
    return {
      "send-message": (socket: WebSocketWithMetadata, data: SendMessageData) =>
        this.handleSendMessage(socket, data),
      "edit-message": (socket: WebSocketWithMetadata, data: EditMessageData) =>
        this.handleEditMessage(socket, data),
      "delete-message": (
        socket: WebSocketWithMetadata,
        data: DeleteMessageData
      ) => this.handleDeleteMessage(socket, data),
      "join-cabal": (socket: WebSocketWithMetadata, data: JoinCabalData) =>
        this.handleJoinCabal(socket, data),
      "leave-cabal": (socket: WebSocketWithMetadata, data: LeaveCabalData) =>
        this.handleLeaveCabal(socket, data),
      "create-cabal": (
        socket: WebSocketWithMetadata,
        data: CreateCabalData
      ) => {
        console.log("create-cabal", data.cabalName);
        this.handleCreateCabal(socket, data);
      },
    };
  }

  private async handleSendMessage(
    socket: WebSocketWithMetadata,
    data: SendMessageData
  ) {
    try {
      const message = {
        id: crypto.randomUUID(),
        username: socket.username,
        content: data.message,
        roomName: data.cabalName,
        timestamp: Date.now(),
      };

      await this.messageManager.storeMessage(message);
      await this.cabalManager.refreshCabalTTL(data.cabalName);
    } catch (error) {
      console.error("Error handling send message:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to send message"
      );
    }
  }

  private async handleEditMessage(
    socket: WebSocketWithMetadata,
    data: EditMessageData
  ) {
    try {
      const result = await this.messageManager.editMessage(
        data.messageId,
        data.newContent,
        socket.username
      );
      if (!result) {
        this.broadcastManager.broadcastError(
          socket.username,
          "Message not found"
        );
      }
    } catch (error) {
      console.error("Error handling edit message:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to edit message"
      );
    }
  }

  private async handleDeleteMessage(
    socket: WebSocketWithMetadata,
    data: DeleteMessageData
  ) {
    try {
      const success = await this.messageManager.deleteMessage(
        data.messageId,
        socket.username
      );
      if (!success) {
        this.broadcastManager.broadcastError(
          socket.username,
          "Message not found"
        );
      }
    } catch (error) {
      console.error("Error handling delete message:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to delete message"
      );
    }
  }

  private async handleJoinCabal(
    socket: WebSocketWithMetadata,
    data: JoinCabalData
  ) {
    try {
      const success = await this.cabalManager.joinCabal(
        socket.username,
        data.cabalName
      );
      if (success) {
        socket.currentRoom = data.cabalName;
        const history = await this.messageManager.getRoomHistory(
          data.cabalName
        );
        this.broadcastManager.broadcastToUser(socket.username, {
          event: "cabal-history",
          cabalName: data.cabalName,
          messages: history,
        });
      }
    } catch (error) {
      console.error("Error handling join cabal:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to join cabal"
      );
    }
  }

  private async handleLeaveCabal(
    socket: WebSocketWithMetadata,
    data: LeaveCabalData
  ) {
    try {
      await this.cabalManager.leaveCabal(socket.username, data.cabalName);
    } catch (error) {
      console.error("Error handling leave cabal:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to leave cabal"
      );
    }
  }

  private async handleCreateCabal(
    socket: WebSocketWithMetadata,
    data: CreateCabalData
  ) {
    try {
      const cabal = await this.cabalManager.createCabal(data.cabalName);
      if (!cabal) {
        this.broadcastManager.broadcastError(
          socket.username,
          "Cabal already exists"
        );
      }
    } catch (error) {
      console.error("Error handling create cabal:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to create cabal"
      );
    }
  }

  private handleCabalEvent(event: CabalEvent): void {
    switch (event.type) {
      case "created":
        this.broadcastManager.broadcastRoomList();
        break;
      case "joined":
        this.broadcastManager.broadcastRoomMembers(event.cabalName);
        this.broadcastManager.broadcastRoomList();
        break;
      case "left":
        this.broadcastManager.broadcastRoomMembers(event.cabalName);
        this.broadcastManager.broadcastRoomList();
        break;
      case "expired":
        this.broadcastManager.broadcastToAll({
          event: "expired",
          cabalName: event.cabalName,
        });
        this.broadcastManager.broadcastRoomList();
        break;
    }
  }

  private handleMessageEvent(event: MessageEvent): void {
    const { message } = event;
    switch (event.type) {
      case "created":
        this.broadcastManager.broadcastToRoom(message.roomName, {
          event: "new-message",
          message,
        });
        break;
      case "edited":
        this.broadcastManager.broadcastToRoom(message.roomName, {
          event: "message-edited",
          message,
        });
        break;
      case "deleted":
        this.broadcastManager.broadcastToRoom(message.roomName, {
          event: "message-deleted",
          messageId: message.id,
        });
        break;
    }
  }

  private handleClientDisconnect(username: string): void {
    const client = this.webSocketManager.getClient(username);
    if (client?.currentRoom) {
      this.cabalManager.leaveCabal(username, client.currentRoom);
    }
    this.broadcastManager.broadcastUserList();
  }

  public cleanup(): void {
    this.cabalManager.dispose();
    // Close all WebSocket connections
    for (const client of this.webSocketManager.getConnectedClients().values()) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000, "Server shutting down");
        }
      } catch (error) {
        console.error("Error closing client:", error);
      }
    }
  }
}
