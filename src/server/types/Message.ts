import { RoomType } from "./Room.ts";

export interface Message {
  id: string;
  roomName: string;
  username: string;
  avatar_url: string;
  content: string;
  timestamp: number;
  edited?: number;
  deleted?: boolean;
}

export interface IMessageManager {
  storeMessage(message: Message): Promise<void>;
  getMessage(id: string): Promise<Message | null>;
  editMessage(
    id: string,
    newContent: string,
    username: string
  ): Promise<Message | null>;
  deleteMessage(
    id: string,
    username: string
  ): Promise<{ success: boolean; message: Message } | false>;
  getRoomHistory(roomName: string, limit?: number): Promise<Message[]>;
}

export type MessageEvent = {
  type: "created" | "edited" | "deleted";
  message: Message;
};

export interface SendMessageData {
  message: string;
  roomName: string;
}

export interface EditMessageData {
  messageId: string;
  newContent: string;
}

export interface DeleteMessageData {
  messageId: string;
}

export interface JoinRoomData {
  roomName: string;
}

export interface LeaveRoomData {
  roomName: string;
}

export interface CreateRoomData {
  roomName: string;
  roomType: RoomType;
  initialMembers: string[];
}
