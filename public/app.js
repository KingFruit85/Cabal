import { MultiConversationLayout } from "./Components/MultiConversationLayout.js";

const username = prompt("Please enter your name") || "Anonymous";
const url = new URL(`./start_web_socket?username=${username}`, location.href);
url.protocol = url.protocol.replace("http", "ws");
export const socket = new WebSocket(url);

// Create the layout manager
const conversationLayout = new MultiConversationLayout(socket, username);

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.event) {
    case "update-users":
      updateUserList(data.usernames);
      break;
    case "update-cabals":
      updateCabalList(data.cabals);
      break;
    case "send-message":
      conversationLayout.addMessage(data.roomName, data.username, data.message);
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
      // Optionally show error to user
      alert(data.message);
      break;
  }
};

function updateCabalList(cabals) {
  const cabalList = document.getElementById("cabals");
  cabalList.replaceChildren();

  for (const cabal of cabals) {
    const listItem = document.createElement("li");
    listItem.textContent = `${cabal.name}`;

    // Add active class if this is the current active conversation
    if (conversationLayout.activeConversation === cabal.name) {
      listItem.classList.add("active");
    }

    listItem.onclick = () => {
      // Remove active class from all cabal items
      cabalList.querySelectorAll("li").forEach((item) => {
        item.classList.remove("active");
      });

      // Add active class to clicked item
      listItem.classList.add("active");

      // First ensure the conversation window exists or create it
      conversationLayout.addConversation(cabal.name);
      // Then explicitly set it as active
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

function updateUserList(usernames) {
  const userList = document.getElementById("users");
  userList.replaceChildren();

  for (const username of usernames) {
    const listItem = document.createElement("li");
    listItem.textContent = username;
    userList.appendChild(listItem);
  }
}

// Create cabal button handler
document.getElementById("create-cabal").onclick = () => {
  const name = prompt("Enter cabal name:");
  if (name) {
    socket.send(
      JSON.stringify({
        event: "create-cabal",
        name,
      })
    );
  }
};
