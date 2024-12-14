import { IMessageManager, Message, MessageEvent } from "../types/Message.ts";

export class MessageManager implements IMessageManager {
  private kv!: Deno.Kv;
  private initialized = false;

  constructor(private readonly onMessageEvent: (event: MessageEvent) => void) {
    this.initializeKv();
  }

  private async initializeKv(): Promise<void> {
    try {
      this.kv = await Deno.openKv();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize KV store:", error);
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async waitForInitialization(): Promise<void> {
    while (!this.initialized) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  public async storeMessage(message: Message): Promise<void> {
    try {
      // Store by timestamp for room history
      const timeKey = [
        "messages",
        message.roomName,
        message.timestamp,
        message.id,
      ];
      await this.kv.set(timeKey, message);

      // Store by ID for quick lookups
      const idKey = ["message_by_id", message.id];
      await this.kv.set(idKey, message);

      this.onMessageEvent({
        type: "created",
        message,
      });
    } catch (error) {
      console.error("Error storing message:", error);
      throw error;
    }
  }

  public async getMessage(id: string): Promise<Message | null> {
    try {
      const result = await this.kv.get<Message>(["message_by_id", id]);
      return result.value;
    } catch (error) {
      console.error("Error getting message:", error);
      return null;
    }
  }

  public async editMessage(
    id: string,
    newContent: string,
    username: string
  ): Promise<Message | null> {
    try {
      const message = await this.getMessage(id);

      if (!message) {
        return null;
      }

      if (message.username !== username) {
        throw new Error("Not authorized to edit this message");
      }

      const updatedMessage: Message = {
        ...message,
        content: newContent,
        edited: Date.now(),
      };

      // Update both storage locations
      await this.kv.set(["message_by_id", id], updatedMessage);
      await this.kv.set(
        ["messages", message.roomName, message.timestamp, id],
        updatedMessage
      );

      this.onMessageEvent({
        type: "edited",
        message: updatedMessage,
      });

      return updatedMessage;
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  public async deleteMessage(id: string, username: string): Promise<boolean> {
    try {
      const message = await this.getMessage(id);

      if (!message) {
        return false;
      }

      if (message.username !== username) {
        throw new Error("Not authorized to delete this message");
      }

      const deletedMessage: Message = {
        ...message,
        deleted: true,
      };

      // Update both storage locations
      await this.kv.set(["message_by_id", id], deletedMessage);
      await this.kv.set(
        ["messages", message.roomName, message.timestamp, id],
        deletedMessage
      );

      this.onMessageEvent({
        type: "deleted",
        message: deletedMessage,
      });

      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  public async getRoomHistory(
    roomName: string,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const messages: Message[] = [];
      const prefix = ["messages", roomName];

      const entries = this.kv.list<Message>({ prefix });

      for await (const entry of entries) {
        if (entry.value) {
          messages.push(entry.value);
        }

        if (messages.length >= limit) {
          break;
        }
      }

      // Sort by timestamp, newest first
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error("Error getting room history:", error);
      return [];
    }
  }

  public async deleteRoomMessages(roomName: string): Promise<void> {
    try {
      const prefix = ["messages", roomName];
      const entries = this.kv.list({ prefix });

      for await (const entry of entries) {
        await this.kv.delete(entry.key);
        // Also delete the message_by_id reference
        if ((entry.value as Message)?.id) {
          await this.kv.delete(["message_by_id", (entry.value as Message)?.id]);
        }
      }
    } catch (error) {
      console.error("Error deleting room messages:", error);
      throw error;
    }
  }

  // Utility method to check message ownership
  public async isMessageOwner(
    messageId: string,
    username: string
  ): Promise<boolean> {
    const message = await this.getMessage(messageId);
    return message?.username === username;
  }
}
