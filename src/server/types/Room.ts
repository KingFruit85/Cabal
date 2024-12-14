// A Cabal is a open room
// A Colloquy is a private room
export type RoomType = "cabal" | "colloquy";

export interface Room {
  name: string;
  type: RoomType;
  members: Set<string>;
  createdAt: number;
  lastActivity: number;
  ttl: number;
}

export type RoomEvent = {
  type: "created" | "joined" | "left" | "expired";
  roomName: string;
  roomType: RoomType;
  username?: string;
};
