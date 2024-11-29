export type Message = {
  id: string; // Unique message ID
  username: string; // Author
  message: string; // Content
  timestamp: number; // Created at
  roomName: string; // Cabal/room name
  edited?: number; // Last edited timestamp
  deleted?: boolean; // Soft delete flag
};

export type MessageEvent =
  | ({ event: "send-message" } & Message)
  | { event: "edit-message"; id: string; message: string }
  | { event: "delete-message"; id: string };
