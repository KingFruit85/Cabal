import { minuteInMs } from "../config/Constants.ts";
import { CreateRoomData } from "../types/Message.ts";
import { Room, RoomEvent } from "../types/Room.ts";
import { MessageManager } from "./MessageManager.ts";

export class RoomManager {
  private rooms = new Map<string, Room>();
  private readonly DEFAULT_TTL = minuteInMs * 4; // 4 minute for testing
  private expirationTimer?: number;
  private messageManager: MessageManager;
  private isInitialized = false;

  constructor(
    private readonly onRoomEvent: (event: RoomEvent) => void,
    messageManager: MessageManager
  ) {
    this.messageManager = messageManager;
    this.initialize().catch(console.error);
  }

  private async initialize(): Promise<void> {
    // Wait for messageManager to initialize
    await this.messageManager.waitForInitialization();
    this.isInitialized = true;

    // Start expiration check only after initialization
    this.expirationTimer = setInterval(() => {
      this.checkExpiredRooms().catch(console.error);
    }, 10000);
  }

  public createRoom(data: CreateRoomData): Room | null {
    if (this.rooms.has(data.roomName)) {
      return null;
    }

    const room: Room = {
      name: data.roomName,
      members: new Set(data.initialMembers),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ttl: this.DEFAULT_TTL,
      type: data.roomType,
    };

    this.rooms.set(data.roomName, room);
    console.log(
      `Room created: ${data.roomName} by user ${data.initialMembers}`
    );
    console.log("Rooms:");
    console.table(
      Array.from(this.rooms.entries()).map(([name, room]) => ({
        RoomName: name,
        Members: Array.from(room.members).join(", "),
        CreatedAt: new Date(room.createdAt).toLocaleString(),
        LastActivity: new Date(room.lastActivity).toLocaleString(),
        TTL: room.ttl,
        Type: room.type,
      }))
    );
    this.onRoomEvent({
      type: "created",
      roomName: data.roomName,
      roomType: data.roomType,
    });

    return room;
  }

  public joinRoom(username: string, roomName: string): boolean {
    const room = this.rooms.get(roomName);
    if (!room) {
      return false;
    }

    room.members.add(username);
    this.refreshRoomTTL(roomName);

    this.onRoomEvent({
      type: "joined",
      roomName,
      roomType: room.type,
      username,
    });

    return true;
  }

  public leaveRoom(username: string, roomName: string): void {
    const room = this.rooms.get(roomName);
    if (!room) {
      return;
    }

    room.members.delete(username);

    this.onRoomEvent({
      type: "left",
      roomName,
      username,
      roomType: room.type,
    });

    // If no members left, start TTL countdown
    if (room.members.size === 0) {
      this.refreshRoomTTL(roomName);
    }
  }

  public refreshRoomTTL(roomName: string): void {
    const room = this.rooms.get(roomName);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  public getRoom(roomName: string): Room | undefined {
    return this.rooms.get(roomName);
  }

  public getAllRooms(): Map<string, Room> {
    return this.rooms;
  }

  private async checkExpiredRooms(): Promise<void> {
    if (!this.isInitialized || !this.messageManager.isInitialized()) {
      return;
    }

    const now = Date.now();

    for (const [name, room] of this.rooms.entries()) {
      const timeSinceLastActivity = now - room.lastActivity;

      if (timeSinceLastActivity >= room.ttl) {
        try {
          // Then try to delete messages
          await this.messageManager.deleteRoomMessages(name);

          this.rooms.delete(name);

          this.onRoomEvent({
            type: "expired",
            roomName: name,
            roomType: room.type,
          });

          console.info(`Room expired: ${name}`);
        } catch (error) {
          console.error(`Error handling expiration for room ${name}:`, error);
        }
      }
    }
  }

  public getRoomlMembers(roomName: string): Set<string> | null {
    const room = this.rooms.get(roomName);
    return room ? room.members : null;
  }

  public isMember(username: string, roomName: string): boolean {
    const room = this.rooms.get(roomName);
    return room ? room.members.has(username) : false;
  }

  public dispose(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
    }
  }
}
