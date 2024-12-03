export interface Message {
  id: string;
  roomName: string;
  username: string;
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
    username: string,
  ): Promise<Message | null>;
  deleteMessage(id: string, username: string): Promise<boolean>;
  getRoomHistory(roomName: string, limit?: number): Promise<Message[]>;
}

export type MessageEvent = {
  type: "created" | "edited" | "deleted";
  message: Message;
};

export interface SendMessageData {
  message: string;
  cabalName: string;
}

export interface EditMessageData {
  messageId: string;
  newContent: string;
}

export interface DeleteMessageData {
  messageId: string;
}

export interface JoinCabalData {
  cabalName: string;
}

export interface LeaveCabalData {
  cabalName: string;
}

export interface CreateCabalData {
  cabalName: string;
}
