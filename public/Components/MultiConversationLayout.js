import { ConversationWindow } from "./ConversationWindow.js";

export class MultiConversationLayout {
  constructor(socket, username) {
    this.socket = socket;
    this.currentUsername = username;
    this.activeConversations = new Map();
    this.windowOrder = []; // Keep track of window order
    this.container = document.getElementById("multi-conversation-layout");
    this.container.innerHTML = ""; // Clear any existing content
    this.maxConversations = 4;
    this.activeConversation = null;
    this.setupInput();
    this.setupStyles();
  }

  setupStyles() {
    this.container.classList.add("conversation-grid");
  }

  setupInput() {
    const inputArea = document.createElement("div");
    inputArea.className = "global-input-area";
    inputArea.style.display = "none"; // Initially hidden
    inputArea.innerHTML = `
        <input 
          type="text" 
          class="global-message-input" 
          placeholder="Select a conversation..." 
          disabled
        >
        <button class="global-send-btn" disabled>Send</button>
    `;
    document.querySelector("main").appendChild(inputArea); // Append to main instead

    this.inputArea = inputArea; // Store reference to input area
    this.input = inputArea.querySelector(".global-message-input");
    this.sendButton = inputArea.querySelector(".global-send-btn");

    this.input.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && this.input.value.trim()) {
        this.sendMessage(this.input.value.trim());
      }
    });

    this.sendButton.addEventListener("click", () => {
      if (this.input.value.trim()) {
        this.sendMessage(this.input.value.trim());
      }
    });
  }

  sendMessage(message) {
    if (!this.activeConversation) {
      return;
    }

    if (!this.activeConversations.has(this.activeConversation)) {
      return;
    }

    // Add cabalName to the message event
    this.socket.send(
      JSON.stringify({
        event: "send-message",
        message: message,
        cabalName: this.activeConversation,
      })
    );
    this.input.value = "";
  }

  addConversation(cabalName) {
    // If window already exists, just activate it
    if (this.activeConversations.has(cabalName)) {
      this.setActiveConversation(cabalName);
      return;
    }

    // If we're at max capacity, remove the oldest window
    if (this.activeConversations.size >= this.maxConversations) {
      const oldestCabal = this.windowOrder[0];
      this.removeConversation(oldestCabal);
      this.windowOrder = this.windowOrder.slice(1);
    }

    const conversationWindow = new ConversationWindow(
      cabalName,
      (name) => this.removeConversation(name),
      (name) => {
        this.setActiveConversation(name);
      },
      this.socket, // Pass the socket
      this.currentUsername // Pass the username
    );

    this.activeConversations.set(cabalName, conversationWindow);
    this.windowOrder.push(cabalName);
    this.container.insertBefore(
      conversationWindow.element,
      this.container.lastChild
    );
    this.updateLayout();

    // Send join event to server
    this.socket.send(
      JSON.stringify({
        event: "join-cabal",
        cabalName: cabalName,
      })
    );
  }

  addMessageHistory(cabalName, messages) {
    const conversation = this.activeConversations.get(cabalName);
    if (conversation) {
      conversation.clearMessages();
      messages.forEach((msg) => conversation.addMessage(msg));
    }
  }

  removeConversation(cabalName) {
    const conversation = this.activeConversations.get(cabalName);

    if (conversation) {
      conversation.element.remove();
      this.activeConversations.delete(cabalName);
      this.windowOrder = this.windowOrder.filter((name) => name !== cabalName);

      if (this.activeConversation === cabalName) {
        const remainingCabals = Array.from(this.activeConversations.keys());
        if (remainingCabals.length > 0) {
          this.setActiveConversation(remainingCabals[0]);
        } else {
          this.setActiveConversation(null);
        }
      }

      this.updateLayout();
    }
  }

  setActiveConversation(cabalName) {
    // Remove active class from all conversations
    this.activeConversations.forEach((conversation) => {
      conversation.element.classList.remove("active");
    });

    // Remove active class from all cabal buttons
    document.querySelectorAll("#cabals li").forEach((item) => {
      item.classList.remove("active");
    });

    this.activeConversation = cabalName;

    if (cabalName && this.activeConversations.has(cabalName)) {
      const conversation = this.activeConversations.get(cabalName);

      // Enable input and update UI
      this.input.disabled = false;
      this.sendButton.disabled = false;
      this.input.placeholder = `Message ${cabalName}...`;

      // Add active class to conversation window
      conversation.element.classList.add("active");

      // Find and activate the corresponding cabal button
      const cabalButton = Array.from(
        document.querySelectorAll("#cabals li")
      ).find((item) => item.textContent.startsWith(cabalName));
      if (cabalButton) {
        cabalButton.classList.add("active");
      }

      // Send join event to server
      this.socket.send(
        JSON.stringify({
          event: "join-cabal",
          cabalName: cabalName,
        })
      );

      // Focus the input
      this.input.focus();
    } else {
      // Disable input if no active conversation
      this.input.disabled = true;
      this.sendButton.disabled = true;
      this.input.placeholder = "Select a conversation...";
    }
  }

  updateLayout() {
    this.container.classList.remove("grid-1", "grid-2", "grid-3", "grid-4");
    if (this.activeConversations.size > 0) {
      const gridClass = `grid-${this.activeConversations.size}`;
      this.container.classList.add(gridClass);
      this.inputArea.style.display = "flex";
    } else {
      this.inputArea.style.display = "none";
    }
  }

  addMessage(cabalName, username, message) {
    if (!this.activeConversations.has(cabalName)) {
      this.addConversation(cabalName);
    }

    const conversation = this.activeConversations.get(cabalName);
    if (conversation) {
      // Create a proper message object
      const messageData = {
        id: crypto.randomUUID(),
        username: username,
        message: message,
        timestamp: Date.now(),
        roomName: cabalName,
      };

      conversation.addMessage(messageData);

      if (cabalName !== this.activeConversation) {
        conversation.element.classList.add("has-unread");
      }

      conversation.element.classList.add("message-received");
      setTimeout(() => {
        conversation.element.classList.remove("message-received");
      }, 300);
    }
  }
}
