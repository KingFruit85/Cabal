import { MultiConversationLayout } from "./Components/MultiConversationLayout.ts";

// Define interfaces for our message types
interface BaseEvent {
  event: string;
}

interface UpdateUsersEvent extends BaseEvent {
  event: "update-users";
  usernames: string[];
}

interface UpdateCabalsEvent extends BaseEvent {
  event: "update-cabals";
  cabals: Array<{ name: string }>;
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

interface CabalHistoryEvent extends BaseEvent {
  event: "cabal-history";
  cabalName: string;
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
  cabalName: string;
  id: string;
  message: string;
}

interface DeleteMessageEvent extends BaseEvent {
  event: "delete-message";
  cabalName: string;
  id: string;
}

interface ErrorEvent extends BaseEvent {
  event: "error";
  message: string;
}

interface ExpiredEvent extends BaseEvent {
  event: "expired";
  cabalName: string;
}

type ServerEvent =
  | UpdateUsersEvent
  | UpdateCabalsEvent
  | NewMessageEvent
  | CabalHistoryEvent
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

socket.onmessage = (event: MessageEvent) => {
  const data = JSON.parse(event.data) as ServerEvent;

  switch (data.event) {
    case "update-users":
      updateUserList(data.usernames);
      break;

    case "update-cabals":
      updateCabalList(data.cabals);
      break;

    case "new-message":
      conversationLayout.addMessage(
        data.message.roomName,
        data.message.username,
        data.message.content
      );
      break;

    case "cabal-history":
      conversationLayout.addMessageHistory(data.cabalName, data.messages);
      break;

    case "edit-message": {
      const conversation = conversationLayout.activeConversations.get(
        data.cabalName
      );
      if (conversation) {
        conversation.handleMessageUpdate(data.id, data.message);
      }
      break;
    }

    case "delete-message": {
      const conv = conversationLayout.activeConversations.get(data.cabalName);
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
      console.log("Handling expired room:", data.cabalName);
      conversationLayout.removeConversation(data.cabalName);
      break;
  }
};

function updateCabalList(cabals: Array<{ name: string }>): void {
  const cabalList = document.querySelector<HTMLUListElement>("#cabals");
  if (!cabalList) return;

  cabalList.replaceChildren();

  for (const cabal of cabals) {
    const listItem = document.createElement("li");
    listItem.textContent = `${cabal.name}`;

    if (conversationLayout.activeConversation === cabal.name) {
      listItem.classList.add("active");
    }

    listItem.onclick = () => {
      const items = cabalList.querySelectorAll("li");
      items.forEach((item) => {
        item.classList.remove("active");
      });

      listItem.classList.add("active");
      conversationLayout.addConversation(cabal.name);
      conversationLayout.setActiveConversation(cabal.name);

      socket.send(
        JSON.stringify({
          event: "join-cabal",
          cabalName: cabal.name,
        })
      );
    };
    cabalList.appendChild(listItem);
  }
}

function updateUserList(usernames: string[]): void {
  const userList = document.querySelector<HTMLUListElement>("#users");
  if (!userList) return;

  userList.replaceChildren();

  for (const username of usernames) {
    const listItem = document.createElement("li");
    listItem.textContent = username;
    userList.appendChild(listItem);
  }
}

// Create cabal button handler
const createCabalButton =
  document.querySelector<HTMLButtonElement>("#create-cabal");
if (createCabalButton) {
  createCabalButton.onclick = () => {
    const cabalName = prompt("Enter cabal name:");
    if (cabalName) {
      socket.send(
        JSON.stringify({
          event: "create-cabal",
          cabalName,
        })
      );
    }
  };
}
