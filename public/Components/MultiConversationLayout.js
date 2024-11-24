import { ConversationWindow } from "./ConversationWindow.js";

export class MultiConversationLayout {
  constructor(socket) {
    this.socket = socket;
    this.activeConversations = new Map();
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
    console.log("Attempting to send message");
    console.log("Active conversation:", this.activeConversation);

    if (!this.activeConversation) {
      console.log("No active conversation");
      return;
    }

    if (!this.activeConversations.has(this.activeConversation)) {
      console.log("Active conversation not found in conversation map");
      return;
    }

    // Add cabalName to the message event
    console.log("Sending message to:", this.activeConversation);
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
    console.log("Adding conversation:", cabalName);
    console.log("Current active conversations:", this.activeConversations.size);
    console.log("Container children:", this.container.children.length);
    if (!this.activeConversations.has(cabalName)) {
      const conversationWindow = new ConversationWindow(
        cabalName,
        (name) => this.removeConversation(name),
        (name) => {
          console.log("Activation callback triggered for:", name);
          this.setActiveConversation(name);
        }
      );

      this.activeConversations.set(cabalName, conversationWindow);
      // Just append the new window
      this.container.appendChild(conversationWindow.element);

      // Make sure no other windows are active
      this.activeConversations.forEach((conv, name) => {
        if (name !== cabalName) {
          conv.element.classList.remove("active");
        }
      });

      console.log(
        "After adding window - Container children:",
        this.container.children.length
      );
      console.log(
        "Active conversations map:",
        Array.from(this.activeConversations.keys())
      );

      this.updateLayout();

      // Request to join the cabal
      this.socket.send(
        JSON.stringify({
          event: "join-cabal",
          cabalName: cabalName,
        })
      );
    }
  }

  addMessageHistory(cabalName, messages) {
    const conversation = this.activeConversations.get(cabalName);
    if (conversation) {
      conversation.clearMessages(); // Add this method to ConversationWindow
      messages.forEach((msg) => {
        conversation.addMessage(msg.username, msg.message, msg.timestamp);
      });
    }
  }

  removeConversation(cabalName) {
    console.log("Removing conversation:", cabalName);
    const conversation = this.activeConversations.get(cabalName);

    if (conversation) {
      conversation.element.remove();
      this.activeConversations.delete(cabalName);

      if (this.activeConversation === cabalName) {
        console.log(
          "Removed active conversation, finding new active conversation"
        );
        const remainingCabals = Array.from(this.activeConversations.keys());
        if (remainingCabals.length > 0) {
          console.log("Setting new active conversation:", remainingCabals[0]);
          this.setActiveConversation(remainingCabals[0]);
        } else {
          console.log("No conversations left, clearing active conversation");
          this.setActiveConversation(null);
          this.inputArea.style.display = "none"; // Hide input when last window closes
        }
      }

      this.updateLayout();
      console.log(
        "Remaining conversations:",
        Array.from(this.activeConversations.keys())
      );
    }
  }

  setActiveConversation(cabalName) {
    console.log("Setting active conversation:", cabalName);

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
    console.log("Updating layout");
    console.log("Active conversations size:", this.activeConversations.size);
    console.log("Container classes before:", this.container.className);

    this.container.classList.remove("grid-1", "grid-2", "grid-3", "grid-4");
    if (this.activeConversations.size > 0) {
      const gridClass = `grid-${this.activeConversations.size}`;
      console.log("Adding grid class:", gridClass);
      this.container.classList.add(gridClass);
      this.inputArea.style.display = "flex";
    } else {
      this.inputArea.style.display = "none";
    }

    console.log("Container classes after:", this.container.className);
  }

  addMessage(cabalName, username, message) {
    console.log("Adding message to conversation:", cabalName);

    // If the conversation window doesn't exist yet, create it
    if (!this.activeConversations.has(cabalName)) {
      this.addConversation(cabalName);

      // Send join event to server
      this.socket.send(
        JSON.stringify({
          event: "join-cabal",
          cabalName: cabalName,
        })
      );
    }

    const conversation = this.activeConversations.get(cabalName);
    if (conversation) {
      conversation.addMessage(username, message);

      // If this is not the active conversation, show unread indicator
      if (cabalName !== this.activeConversation) {
        conversation.element.classList.add("has-unread");
      }

      // Add subtle highlight animation
      conversation.element.classList.add("message-received");
      setTimeout(() => {
        conversation.element.classList.remove("message-received");
      }, 300);
    }
  }
}
