import { WebSocketWithMetadata } from "../types/WebSocket.ts";
import { BroadcastEvent, IBroadcastManager } from "../types/Broadcast.ts";
import { ICabalManager } from "../types/Room.ts";

export class BroadcastManager implements IBroadcastManager {
  constructor(
    private readonly getConnectedClients: () => Map<
      string,
      WebSocketWithMetadata
    >,
    private readonly cabalManager: ICabalManager
  ) {}

  public broadcastToAll(event: BroadcastEvent): void {
    const messageString = JSON.stringify(event);
    const clients = this.getConnectedClients();

    for (const client of clients.values()) {
      this.sendToClient(client, messageString);
    }
  }

  public broadcastToRoom(roomName: string, event: BroadcastEvent): void {
    const messageString = JSON.stringify(event);
    const clients = this.getConnectedClients();

    for (const client of clients.values()) {
      if (client.currentRoom === roomName) {
        this.sendToClient(client, messageString);
      }
    }
  }

  public broadcastToUser(username: string, event: BroadcastEvent): void {
    const client = this.getConnectedClients().get(username);
    if (client) {
      this.sendToClient(client, JSON.stringify(event));
    }
  }

  public broadcastUserList(): void {
    const clients = this.getConnectedClients();
    const usernames = Array.from(clients.keys());

    this.broadcastToAll({
      event: "update-users",
      users: usernames,
    });
  }

  public broadcastRoomList(): void {
    const cabals = this.cabalManager.getAllCabals();
    const cabalList = Array.from(cabals.values()).map((cabal) => ({
      name: cabal.name,
      memberCount: cabal.members.size,
    }));

    this.broadcastToAll({
      event: "update-cabals",
      cabals: cabalList,
    });
  }

  public broadcastRoomMembers(roomName: string): void {
    const cabal = this.cabalManager.getCabal(roomName);
    if (!cabal) return;

    this.broadcastToRoom(roomName, {
      event: "update-room-members",
      roomName,
      members: Array.from(cabal.members),
    });
  }

  public broadcastError(username: string, error: string): void {
    this.broadcastToUser(username, {
      event: "error",
      message: error,
    });
  }

  private sendToClient(client: WebSocketWithMetadata, message: string): void {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    } catch (error) {
      console.error(`Error sending to client ${client.username}:`, error);
    }
  }

  // Optional: Add retry logic for important messages
  public async broadcastWithRetry(
    event: BroadcastEvent,
    recipients: string[],
    maxRetries: number = 3
  ): Promise<void> {
    const messageString = JSON.stringify(event);
    const clients = this.getConnectedClients();

    for (const username of recipients) {
      const client = clients.get(username);
      if (!client) continue;

      let retries = 0;
      while (retries < maxRetries) {
        try {
          await this.sendToClientAsync(client, messageString);
          break;
        } catch (_error) {
          retries++;
          if (retries === maxRetries) {
            console.error(
              `Failed to send message to ${username} after ${maxRetries} attempts`
            );
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
          }
        }
      }
    }
  }

  private async sendToClientAsync(
    client: WebSocketWithMetadata,
    message: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          resolve();
        } else {
          reject(new Error("Client not ready"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Optional: Add batch broadcasting
  public broadcastToBatch(
    event: BroadcastEvent,
    usernames: string[],
    batchSize: number = 50
  ): void {
    const messageString = JSON.stringify(event);
    const clients = this.getConnectedClients();

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < usernames.length; i += batchSize) {
      const batch = usernames.slice(i, i + batchSize);

      for (const username of batch) {
        const client = clients.get(username);
        if (client) {
          this.sendToClient(client, messageString);
        }
      }
    }
  }

  // Optional: Add message queuing for offline users
  private messageQueue = new Map<string, BroadcastEvent[]>();

  public queueMessageForUser(username: string, event: BroadcastEvent): void {
    if (!this.messageQueue.has(username)) {
      this.messageQueue.set(username, []);
    }
    this.messageQueue.get(username)?.push(event);
  }

  public deliverQueuedMessages(username: string): void {
    const messages = this.messageQueue.get(username);
    if (messages?.length) {
      messages.forEach((event) => this.broadcastToUser(username, event));
      this.messageQueue.delete(username);
    }
  }
}
