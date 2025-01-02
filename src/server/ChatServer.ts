import { Context } from "@oak/oak";
import { WebSocketManager } from "./managers/WebSocketManager.ts";
import { MessageManager } from "./managers/MessageManager.ts";
import { BroadcastManager } from "./managers/BroadcastManager.ts";
import { RoomManager } from "./managers/RoomManager.ts";
import { WebSocketWithMetadata } from "./types/WebSocket.ts";
import { Message, MessageEvent } from "./types/Message.ts";
import {
  CreateRoomData,
  DeleteMessageData,
  EditMessageData,
  JoinRoomData,
  LeaveRoomData,
  SendMessageData,
} from "./types/Message.ts";
import { RoomEvent } from "./types/Room.ts";
import { GitHubUser } from "./types/GitHubUser.ts";
import { KvTools } from "./utils/kv/store.ts";

export default class ChatServer {
  private webSocketManager: WebSocketManager;
  private messageManager: MessageManager;
  private roomManager: RoomManager;
  private broadcastManager: BroadcastManager;

  constructor() {
    // Initialize managers with their event handlers
    this.messageManager = new MessageManager((event) =>
      this.handleMessageEvent(event)
    );

    this.roomManager = new RoomManager(
      (event) => this.handleRoomEvent(event),
      this.messageManager
    );

    this.broadcastManager = new BroadcastManager(
      () => this.webSocketManager.getConnectedClients(),
      this.roomManager
    );

    this.webSocketManager = new WebSocketManager(
      (username) => this.handleClientDisconnect(username),
      this.getMessageHandlers(),
      this.broadcastManager
    );
  }

  public async handleConnection(
    ctx: Context,
    userDetails: GitHubUser,
    sessionId: string
  ): Promise<void> {
    await this.webSocketManager.handleConnection(ctx, userDetails, sessionId);
    this.broadcastManager.broadcastRoomList();
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
      "join-room": (socket: WebSocketWithMetadata, data: JoinRoomData) =>
        this.handleJoinRoom(socket, data),
      "leave-room": (socket: WebSocketWithMetadata, data: LeaveRoomData) =>
        this.handleLeaveRoom(socket, data),
      "create-room": (socket: WebSocketWithMetadata, data: CreateRoomData) => {
        this.handleCreateRoom(socket, data);
      },
      "create-private-chat": (
        socket: WebSocketWithMetadata,
        data: CreateRoomData
      ) => {
        this.handleCreateRoom(socket, data);
      },
    };
  }

  private async handleSendMessage(
    socket: WebSocketWithMetadata,
    data: SendMessageData
  ) {
    try {
      const kvTools = await KvTools.create();
      const userDetails = await kvTools.getUser(socket.sessionId); // Add sessionId to WebSocketWithMetadata type

      if (userDetails) {
        const message = {
          id: crypto.randomUUID(),
          username: socket.username,
          avatar_url: userDetails?.avatar_url,
          content: data.message,
          roomName: data.roomName,
          timestamp: Date.now(),
        } as Message;

        await this.messageManager.storeMessage(message);
        await this.roomManager.refreshRoomTTL(data.roomName);
        return;
      }
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
      const result = await this.messageManager.deleteMessage(
        data.messageId,
        socket.username
      );

      if (!result.success) {
        this.broadcastManager.broadcastError(
          socket.username,
          "Message not found"
        );
      } else {
        const history = await this.messageManager.getRoomHistory(
          result.message.roomName
        );
        this.broadcastManager.broadcastToUser(socket.username, {
          event: "room-history",
          roomName: result.message.roomName,
          messages: history,
        });
      }
    } catch (error) {
      console.error("Error handling delete message:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to delete message"
      );
    }
  }

  private async handleJoinRoom(
    socket: WebSocketWithMetadata,
    data: JoinRoomData
  ) {
    try {
      const success = await this.roomManager.joinRoom(
        socket.username,
        data.roomName
      );

      if (success) {
        socket.currentRoom = data.roomName;
        const history = await this.messageManager.getRoomHistory(data.roomName);

        this.broadcastManager.broadcastToUser(socket.username, {
          event: "room-history",
          roomName: data.roomName,
          messages: history,
        });
      }
    } catch (error) {
      console.error("Error handling join room:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to join room"
      );
    }
  }

  private async handleLeaveRoom(
    socket: WebSocketWithMetadata,
    data: LeaveRoomData
  ) {
    try {
      await this.roomManager.leaveRoom(socket.username, data.roomName);
    } catch (error) {
      console.error("Error handling leave room:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to leave room"
      );
    }
  }

  private async handleCreateRoom(
    socket: WebSocketWithMetadata,
    data: CreateRoomData
  ) {
    console.log("Creating room:", data);
    try {
      const room = await this.roomManager.createRoom(data);
    } catch (error) {
      console.error("Error handling create room:", error);
      this.broadcastManager.broadcastError(
        socket.username,
        "Failed to create room"
      );
    }
  }

  private handleRoomEvent(event: RoomEvent): void {
    switch (event.type) {
      case "created":
        this.broadcastManager.broadcastRoomList();
        break;
      case "joined":
        this.broadcastManager.broadcastRoomMembers(event.roomName);
        this.broadcastManager.broadcastRoomList();
        break;
      case "left":
        this.broadcastManager.broadcastRoomMembers(event.roomName);
        this.broadcastManager.broadcastRoomList();
        break;
      case "expired":
        this.broadcastManager.broadcastToAll({
          event: "expired",
          roomName: event.roomName,
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
          event: "delete-message",
          messageId: message.id,
        });
        break;
    }
  }

  private handleClientDisconnect(username: string): void {
    const client = this.webSocketManager.getClient(username);
    if (client?.currentRoom) {
      this.roomManager.leaveRoom(username, client.currentRoom);
    }
    this.broadcastManager.broadcastUserList();
  }

  public cleanup(): void {
    this.roomManager.dispose();
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
