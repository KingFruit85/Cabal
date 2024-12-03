export type BroadcastEvent = {
  event: string;
  [key: string]: any;
};

export interface IBroadcastManager {
  broadcastToAll(event: BroadcastEvent): void;
  broadcastToRoom(roomName: string, event: BroadcastEvent): void;
  broadcastToUser(username: string, event: BroadcastEvent): void;
  broadcastUserList(): void;
  broadcastRoomList(): void;
}
