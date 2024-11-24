import { Context } from "@oak/oak";
import { DayInMs } from "./Consts.ts";
import { Cabal } from "./Types/Rooms.ts";

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
  }

  private startCabalExpirationCheck() {
    const checkInterval = 10 * 1000; // Check every 10 seconds

    setInterval(() => {
      const now = Date.now();
      for (const [name, cabal] of this.cabals) {
        if (now - cabal.createdAt >= cabal.ttl) {
          console.log("checking for expired cabals");
          this.cabals.delete(name);
          this.broadcastCabalList();
          Deno.remove(`./ChatLogs/${name}`);
          console.log(`Cabal expired and removed: ${name}`);
        }
      }
    }, checkInterval);
  }

  public async handleConnection(ctx: Context) {
    const socket = (await ctx.upgrade()) as WebSocketWithMetadata;
    const username = ctx.request.url.searchParams.get("username") as string;

    if (this.connectedClients.has(username)) {
      socket.close(1008, `Username ${username} is already taken`);
      return;
    }
    socket.username = username;
    socket.currentRoom = "general"; // Default cabal

    socket.onopen = () => {
      console.log(this.cabals);
      // Add user to connected clients first
      this.connectedClients.set(username, socket);

      // Then join them to general room
      this.joinCabal(socket, "general", true);

      // Broadcast updates
      this.broadcastCabalList();
      this.broadcastUserList();

      console.log(`New client connected: ${username}`);
      console.log("Current room:", socket.currentRoom);
    };

    socket.onclose = () => this.clientDisconnected(socket.username);
    socket.onmessage = (m) => this.handleMessage(socket, m);
  }

  private handleMessage(socket: WebSocketWithMetadata, message: any) {
    const data = JSON.parse(message.data);
    console.log("Received message:", data);
    console.log("Current socket room:", socket.currentRoom);

    switch (data.event) {
      case "send-message":
        // Use the cabalName from the message instead of socket.currentRoom
        this.sendMessage(
          socket.username,
          data.cabalName, // Use cabalName from message
          data.message
        );
        break;
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

    console.log(`New cabal created: ${name}`);
  }

  private async joinCabal(
    socket: WebSocketWithMetadata,
    cabalName: string,
    initialJoin: boolean = false
  ) {
    console.log(`Joining cabal: ${cabalName} for user: ${socket.username}`);
    const cabal = this.cabals.get(cabalName);
    if (!cabal) {
      console.log(`Cabal ${cabalName} not found`);
      return;
    }

    // Add member to cabal
    cabal.members.set(socket.username, new Date());
    socket.currentRoom = cabalName;

    // Send chat history
    const history = await this.getCabalHistory(cabalName);
    socket.send(
      JSON.stringify({
        event: "cabal-history",
        cabalName,
        messages: history,
      })
    );

    // Notify about join
    this.broadcastToCabal(cabalName, {
      event: "cabal-joined",
      username: socket.username,
      cabalName,
    });

    this.broadcastCabalMembers(cabalName);
    this.broadcastCabalList();
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
    console.log(
      `Sending message to cabal: ${cabalName} from user: ${username}`
    );

    const cabal = this.cabals.get(cabalName);
    if (!cabal) {
      console.log(`Cabal ${cabalName} not found`);
      return;
    }

    const messageEvent = {
      event: "send-message",
      username,
      message,
      cabalName,
      timestamp: Date.now(),
    };

    // Store message first
    await this.storeCabalMessage(cabalName, messageEvent);

    // Then broadcast
    this.broadcastToCabal(cabalName, messageEvent);
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

    console.log(cabalList);

    this.broadcast({
      event: "update-cabals",
      cabals: cabalList,
    });
  }

  private broadcastCabalMembers(cabalName: string) {
    console.log("Broadcasting cabal members for " + cabalName);
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

    // Send to all connected clients who have this conversation open
    // Instead of checking cabal membership
    const messageString = JSON.stringify(message);
    for (const client of this.connectedClients.values()) {
      client.send(messageString);
    }
  }

  private broadcast(message: AppEvent) {
    const messageString = JSON.stringify(message);

    for (const client of this.connectedClients.values()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      } else {
        console.log(`Skipping client ${client.username} - not ready`);
      }
    }
  }

  private async storeCabalMessage(cabalName: string, message: AppEvent) {
    try {
      const messageLog =
        JSON.stringify({
          ...message,
          timestamp: Date.now(),
        }) + "\n";

      await Deno.writeTextFile(`./ChatLogs/${cabalName}.json`, messageLog, {
        append: true,
      });
    } catch (error) {
      console.error(`Error storing message for ${cabalName}:`, error);
    }
  }

  private async getCabalHistory(cabalName: string): Promise<AppEvent[]> {
    try {
      const content = await Deno.readTextFile(`./ChatLogs/${cabalName}.json`);
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch (error) {
      console.log(`No history found for ${cabalName}`);
      return [];
    }
  }
}
