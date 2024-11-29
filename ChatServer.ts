import { Context } from "@oak/oak";
import { DayInMs } from "./Consts.ts";
import { Cabal } from "./Types/Rooms.ts";
import { Message } from "./Types/Mesages.ts";

type WebSocketWithMetadata = WebSocket & {
  username: string;
  currentRoom: string;
};

type AppEvent = {
  event: string;
  [key: string]: any;
};

export default class ChatServer {
  private connectedClients = new Map<string, WebSocketWithMetadata>();
  private cabals = new Map<string, Cabal>();

  private generateMessageId(): string {
    return crypto.randomUUID();
  }

  // Store a message
  private async storeMessage(message: Message) {
    const kv = await Deno.openKv();
    const key = ["messages", message.roomName, message.timestamp, message.id];
    await kv.set(key, message);

    // Store a reference by ID for quick lookups
    await kv.set(["message_by_id", message.id], message);
  }

  // Get a specific message by ID
  private async getMessage(id: string): Promise<Message | null> {
    const kv = await Deno.openKv();
    const result = await kv.get<Message>(["message_by_id", id]);
    return result.value;
  }

  constructor() {
    this.cabals = new Map<string, Cabal>();
    this.cabals.set("general", {
      name: "general",
      description: "The main chat room",
      members: new Map(),
      createdAt: Date.now(),
      ttl: DayInMs,
    });
    this.cabals.set("games", {
      name: "games",
      description: "The main chat room",
      members: new Map(),
      createdAt: Date.now(),
      ttl: DayInMs,
    });
    this.cabals.set("music", {
      name: "music",
      description: "The main chat room",
      members: new Map(),
      createdAt: Date.now(),
      ttl: DayInMs,
    });
    this.cabals.set("work", {
      name: "work",
      description: "The main chat room",
      members: new Map(),
      createdAt: Date.now(),
      ttl: DayInMs,
    });
    this.startCabalExpirationCheck();
    Deno.addSignalListener("SIGINT", () => this.cleanup());
    Deno.addSignalListener("SIGTERM", () => this.cleanup());
  }

  private startCabalExpirationCheck() {
    const checkInterval = 10 * 1000; // Check every 10 seconds

    setInterval(() => {
      const now = Date.now();
      for (const [name, cabal] of this.cabals) {
        if (now - cabal.createdAt >= cabal.ttl) {
          this.cabals.delete(name);
          this.broadcastCabalList();
          Deno.remove(`./ChatLogs/${name}`);
        }
      }
    }, checkInterval);
  }

  public async handleConnection(ctx: Context) {
    try {
      const socket = (await ctx.upgrade()) as WebSocketWithMetadata;
      const username = ctx.request.url.searchParams.get("username") as string;

      if (this.connectedClients.has(username)) {
        socket.close(1008, `Username ${username} is already taken`);
        return;
      }
      socket.username = username;
      socket.currentRoom = "general"; // Default cabal

      socket.onopen = async () => {
        try {
          this.connectedClients.set(username, socket);

          await new Promise((resolve) => setTimeout(resolve, 100));

          await this.joinCabal(socket, "general", true);

          this.broadcastCabalList();
          this.broadcastUserList();
        } catch (error) {
          console.error("Error in onopen handler:", error);
        }
      };

      socket.onerror = (error) => {
        console.error(`WebSocket error for ${username}:`, error);
      };

      socket.onclose = () => {
        try {
          this.clientDisconnected(socket.username);
        } catch (error) {
          console.error("Error in onclose handler:", error);
        }
      };

      socket.onmessage = (m) => {
        try {
          this.handleMessage(socket, m);
        } catch (error) {
          console.error("Error in onmessage handler:", error);
        }
      };
    } catch (error) {
      console.error("Error in handleConnection:", error);
      throw error;
    }
  }

  private async handleMessage(socket: WebSocketWithMetadata, rawMessage: any) {
    const data = JSON.parse(rawMessage.data);

    switch (data.event) {
      case "send-message":
        // Use the cabalName from the message instead of socket.currentRoom
        this.sendMessage(
          socket.username,
          data.cabalName, // Use cabalName from message
          data.message
        );
        break;
      case "edit-message": {
        const editResult = await this.editMessage(
          data.id,
          data.message,
          socket.username
        );
        if (editResult.error) {
          socket.send(
            JSON.stringify({
              event: "error",
              message: editResult.error,
            })
          );
        }
        break;
      }
      case "delete-message": {
        const deleteResult = await this.deleteMessage(data.id, socket.username);
        if (deleteResult.error) {
          socket.send(
            JSON.stringify({
              event: "error",
              message: deleteResult.error,
            })
          );
        }
        break;
      }

      case "create-cabal":
        this.createCabal(data.name, data.description);
        break;
      case "join-cabal":
        this.joinCabal(socket, data.cabalName);
        break;
      case "leave-cabal":
        this.leaveCabal(socket, data.cabalName);
        break;
    }
  }

  private async createCabal(name: string, description?: string) {
    if (this.cabals.has(name)) {
      return;
    }

    this.cabals.set(name, {
      name,
      description,
      members: new Map(),
      ttl: DayInMs,
      createdAt: Date.now(),
    });

    this.broadcastCabalList();
  }

  private async joinCabal(
    socket: WebSocketWithMetadata,
    cabalName: string,
    initialJoin: boolean = false
  ) {
    const cabal = this.cabals.get(cabalName);
    if (!cabal) {
      return;
    }

    // Add member to cabal
    cabal.members.set(socket.username, new Date());
    socket.currentRoom = cabalName;

    try {
      // Send chat history only if socket is ready
      if (socket.readyState === WebSocket.OPEN) {
        const history = await this.getCabalHistory(cabalName);
        socket.send(
          JSON.stringify({
            event: "cabal-history",
            cabalName,
            messages: history,
          })
        );
      } else {
        console.error(
          `Socket not ready for ${socket.username} in ${cabalName}`
        );
      }

      // Notify about join
      this.broadcastToCabal(cabalName, {
        event: "cabal-joined",
        username: socket.username,
        cabalName,
      });

      this.broadcastCabalMembers(cabalName);
      this.broadcastCabalList();
    } catch (error) {
      console.error(`Error in joinCabal for ${socket.username}:`, error);
      // Remove member if join failed
      cabal.members.delete(socket.username);
    }
  }

  private leaveCabal(socket: WebSocketWithMetadata, cabalName: string) {
    const cabal = this.cabals.get(cabalName);
    if (!cabal) return;

    cabal.members.delete(socket.username);

    if (socket.currentRoom === cabalName) {
      this.joinCabal(socket, "general", true); // Use initialJoin to prevent loop
    }

    this.broadcastToCabal(cabalName, {
      event: "cabal-left",
      username: socket.username,
      cabalName,
    });
    this.broadcastCabalMembers(cabalName);
  }

  private async sendMessage(
    username: string,
    cabalName: string,
    message: string
  ) {
    const timestamp = Date.now(); // Current timestamp in milliseconds

    const messageData: Message = {
      id: this.generateMessageId(),
      username,
      message,
      timestamp,
      roomName: cabalName,
    };

    await this.storeMessage(messageData);

    this.broadcastToCabal(cabalName, {
      event: "send-message",
      ...messageData,
    });
  }

  private async editMessage(id: string, newMessage: string, username: string) {
    const message = await this.getMessage(id);

    if (!message) {
      return { error: "Message not found" };
    }

    if (message.username !== username) {
      return { error: "Not authorized to edit this message" };
    }

    const updatedMessage: Message = {
      ...message,
      message: newMessage,
      edited: Date.now(),
    };

    await this.storeMessage(updatedMessage);

    // Broadcast the edit
    this.broadcastToCabal(message.roomName, {
      event: "edit-message",
      id,
      message: newMessage,
    });

    return { success: true };
  }

  private async deleteMessage(id: string, username: string) {
    const message = await this.getMessage(id);

    if (!message) {
      return { error: "Message not found" };
    }

    if (message.username !== username) {
      return { error: "Not authorized to delete this message" };
    }

    const updatedMessage: Message = {
      ...message,
      deleted: true,
    };

    // Update storage
    await this.storeMessage(updatedMessage);

    // Broadcast the deletion
    this.broadcastToCabal(message.roomName, {
      event: "delete-message",
      id,
    });

    return { success: true };
  }

  private clientDisconnected(username: string) {
    const socket = this.connectedClients.get(username);
    if (socket) {
      this.leaveCabal(socket, socket.currentRoom);
    }
    this.connectedClients.delete(username);
    this.broadcastUserList();

    console.log(`Client ${username} disconnected`);
  }

  private broadcastCabalList() {
    const cabalList = Array.from(this.cabals.values()).map(
      ({ name, description, members }) => ({
        name,
        description,
        memberCount: members.size,
      })
    );

    this.broadcast({
      event: "update-cabals",
      cabals: cabalList,
    });
  }

  private broadcastCabalMembers(cabalName: string) {
    const cabal = this.cabals.get(cabalName);
    if (!cabal) return;

    this.broadcastToCabal(cabalName, {
      event: "update-cabal-members",
      cabalName,
      members: Array.from(cabal.members),
    });
  }

  private broadcastUserList() {
    const usernames = Array.from(this.connectedClients.keys());
    this.broadcast({ event: "update-users", usernames });
  }

  private broadcastToCabal(cabalName: string, message: AppEvent) {
    const cabal = this.cabals.get(cabalName);
    if (!cabal) return;

    const messageString = JSON.stringify(message);
    for (const client of this.connectedClients.values()) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageString);
        } else {
          console.warn(`Skipping client ${client.username} - not ready`);
        }
      } catch (error) {
        console.error(`Error sending to client ${client.username}:`, error);
      }
    }
  }

  private broadcast(message: AppEvent) {
    const messageString = JSON.stringify(message);

    for (const client of this.connectedClients.values()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      } else {
        console.warn(`Skipping client ${client.username} - not ready`);
      }
    }
  }

  private async getCabalHistory(cabalName: string): Promise<Message[]> {
    const kv = await Deno.openKv();
    const messages: Message[] = [];

    // List all messages for this cabal
    const prefix = ["messages", cabalName];
    const entries = kv.list<Message>({ prefix });

    for await (const entry of entries) {
      if (entry.value) {
        messages.push({
          ...entry.value,
          timestamp: entry.value.timestamp,
        });
      }
    }

    // Sort by timestamp
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  private cleanup() {
    console.info("Cleaning up server...");
    for (const client of this.connectedClients.values()) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000, "Server shutting down");
        }
      } catch (error) {
        console.error("Error closing client:", error);
      }
    }
    this.connectedClients.clear();
    this.cabals.clear();
  }
}
