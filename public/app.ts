import { MultiConversationLayout } from "./Components/MultiConversationLayout.ts";
import { Room } from "../src/server/types/Room.ts";
import { ContextMenu } from "../src/server/types/Ui.ts";
import { CreateRoomData } from "../src/server/types/Message.ts";

// Define interfaces for our message types
interface BaseEvent {
  event: string;
}

interface UpdateUsersEvent extends BaseEvent {
  event: "update-users";
  usernames: string[];
}

interface UpdateRoomsEvent extends BaseEvent {
  event: "update-rooms";
  rooms: Room[];
}

interface NewMessageEvent extends BaseEvent {
  event: "new-message";
  message: {
    roomName: string;
    username: string;
    content: string;
    id: string;
    timestamp: number;
  };
}

interface RoomHistoryEvent extends BaseEvent {
  event: "room-history";
  roomName: string;
  messages: Array<{
    id: string;
    username: string;
    content: string;
    roomName: string;
    timestamp: number;
    edited?: boolean;
  }>;
}

interface EditMessageEvent extends BaseEvent {
  event: "edit-message";
  roomName: string;
  id: string;
  message: string;
}

interface DeleteMessageEvent extends BaseEvent {
  event: "delete-message";
  roomName: string;
  id: string;
}

interface ErrorEvent extends BaseEvent {
  event: "error";
  message: string;
}

interface ExpiredEvent extends BaseEvent {
  event: "expired";
  roomName: string;
}

type ServerEvent =
  | UpdateUsersEvent
  | UpdateRoomsEvent
  | NewMessageEvent
  | RoomHistoryEvent
  | EditMessageEvent
  | DeleteMessageEvent
  | ErrorEvent
  | ExpiredEvent;

// Initialize WebSocket connection
const username = prompt("Please enter your name") ?? "Anonymous";
const url = new URL(`./start_web_socket?username=${username}`, location.href);
url.protocol = url.protocol.replace("http", "ws");
export const socket = new WebSocket(url.href);

// Create the layout manager
const conversationLayout = new MultiConversationLayout(socket, username);
const contextMenu = new ContextMenu();

// Hide context menu when clicking anywhere other than the user list elements
document.addEventListener("click", () => contextMenu.hide());

let lastReceivedRoomData: Array<{
  name: string;
  lastActivity: number;
  ttl: number;
}> | null = null;

socket.onmessage = (event: MessageEvent) => {
  const data = JSON.parse(event.data) as ServerEvent;
  console.log("Received event:", data.event, data);
  switch (data.event) {
    case "update-users":
      updateUserList(data.usernames);
      break;

    case "update-rooms":
      lastReceivedRoomData = data.rooms; // Store the data
      updateRoomList(data.rooms);
      break;

    case "new-message":
      conversationLayout.addMessage(
        data.message.roomName,
        data.message.username,
        data.message.content
      );
      break;

    case "room-history":
      conversationLayout.addMessageHistory(data.roomName, data.messages);
      break;

    case "edit-message": {
      const conversation = conversationLayout.activeConversations.get(
        data.roomName
      );
      if (conversation) {
        conversation.handleMessageUpdate(data.id, data.message);
      }
      break;
    }

    case "delete-message": {
      const conv = conversationLayout.activeConversations.get(data.roomName);
      if (conv) {
        conv.handleMessageDelete(data.id);
      }
      break;
    }

    case "error":
      console.error("Server error:", data.message);
      alert(data.message);
      break;

    case "expired":
      console.info("Handling expired room:", data.roomName);
      conversationLayout.removeConversation(data.roomName);
      break;
  }
};

setInterval(() => {
  if (lastReceivedRoomData) {
    updateRoomList(lastReceivedRoomData);
  }
}, 1000);

function updateRoomList(
  rooms: Array<{ name: string; lastActivity: number; ttl: number }>
): void {
  const roomList = document.querySelector<HTMLUListElement>("#cabals");
  if (!roomList) return;

  roomList.replaceChildren();

  for (const room of rooms) {
    const listItem = document.createElement("li");
    listItem.textContent = `${room.name}`;

    // Calculate how much time has elapsed
    const timeElapsed = Date.now() - room.lastActivity;
    const ttlProgress = Math.min(timeElapsed / room.ttl, 1); // Value between 0 and 1

    // Interpolate between start color (26, 26, 29) and end color (150, 35, 0)
    const r = Math.round(26 + (128 - 26) * ttlProgress);
    const g = Math.round(26 + (0 - 26) * ttlProgress);
    const b = Math.round(29 + (32 - 29) * ttlProgress);

    listItem.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

    if (conversationLayout.activeConversation === room.name) {
      listItem.classList.add("active");
    }

    listItem.onclick = () => {
      const items = roomList.querySelectorAll("li");
      items.forEach((item) => {
        item.classList.remove("active");
      });

      listItem.classList.add("active");
      conversationLayout.addConversation(room.name);
      conversationLayout.setActiveConversation(room.name);

      console.log("updateRoomList");
      socket.send(
        JSON.stringify({
          event: "join-room",
          roomName: room.name,
        })
      );
    };
    roomList.appendChild(listItem);
  }
}

function updateUserList(cohortNames: string[]): void {
  const userList = document.querySelector<HTMLUListElement>("#users");
  if (!userList) return;

  userList.replaceChildren();

  for (const cohortName of cohortNames) {
    // if current username skip
    if (cohortName === username) {
      continue;
    }
    const listItem = document.createElement("li");
    listItem.textContent = cohortName;

    listItem.addEventListener("contextmenu", (event) => {
      event.preventDefault();

      contextMenu.show({
        x: event.pageX,
        y: event.pageY,
        items: [
          {
            label: "Confer",
            action: () => {
              const roomName = `A colloquy between ${[username, cohortName]
                .sort()
                .join(" and ")}`;
              // Sort usernames to ensure consistent room names regardless of who initiates

              socket.send(
                JSON.stringify({
                  event: "create-private-chat",
                  participants: [username, cohortName],
                  roomName: roomName,
                })
              );

              // Add conversation window
              conversationLayout.addConversation(roomName);
            },
          },
        ],
      });
    });

    userList.appendChild(listItem);
  }
}

// Create cabal button handler
const createCabalButton =
  document.querySelector<HTMLButtonElement>("#create-cabal");
if (createCabalButton) {
  createCabalButton.onclick = () => {
    const name = prompt("Enter cabal name:");
    if (name) {
      const data: CreateRoomData = {
        roomName: name,
        roomType: "cabal",
        initialMembers: [username],
      };
      socket.send(
        JSON.stringify({
          event: "create-room",
          ...data,
        })
      );
    }
  };
}
