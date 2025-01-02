import { bgGreen } from "jsr:@std/internal@^1.0.5/styles";
import { ConversationWindow } from "./ConversationWindow.ts";

export class MultiConversationLayout {
  private socket: WebSocket;
  private currentUsername: string;
  public activeConversations: Map<string, ConversationWindow>;
  private windowOrder: string[];
  private container: HTMLDivElement;
  private maxConversations: number;
  public activeConversation: string | null;
  private inputArea: HTMLDivElement;
  private input: HTMLInputElement;
  private sendButton: HTMLButtonElement;

  constructor(socket: WebSocket, username: string) {
    this.socket = socket;
    this.currentUsername = username;
    this.activeConversations = new Map();

    this.inputArea = document.createElement("div");
    this.inputArea.className = "input-area";
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "message-input";
    this.sendButton = document.createElement("button");
    this.sendButton.className = "send-button";
    this.sendButton.textContent = "Send";

    this.windowOrder = [];
    const containerElement = document.getElementById(
      "multi-conversation-layout"
    );
    if (!containerElement) {
      throw new Error("Container element not found");
    }
    this.container = containerElement as HTMLDivElement;
    this.container.innerHTML = "";
    this.maxConversations = 4;
    this.activeConversation = null;
    this.setupInput();
    this.setupStyles();
  }

  private setupStyles(): void {
    this.container.classList.add("conversation-grid");
  }

  private setupInput(): void {
    const inputArea = document.createElement("div");
    inputArea.className = "global-input-area";
    inputArea.style.display = "none";
    inputArea.innerHTML = `
      <input 
        type="text" 
        class="global-message-input" 
        placeholder="Select a conversation..." 
        disabled
      >
      <button class="global-send-btn" disabled>Send</button>
    `;

    const main = document.querySelector("main");
    if (!main) {
      throw new Error("Main element not found");
    }
    main.appendChild(inputArea);

    this.inputArea = inputArea;
    this.input = inputArea.querySelector(
      ".global-message-input"
    ) as HTMLInputElement;
    this.sendButton = inputArea.querySelector(
      ".global-send-btn"
    ) as HTMLButtonElement;

    this.input.addEventListener("keypress", (e: KeyboardEvent) => {
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

  private sendMessage(message: string): void {
    if (!this.activeConversation) {
      return;
    }

    if (!this.activeConversations.has(this.activeConversation)) {
      return;
    }
    console.log(JSON.stringify({ message }));
    console.debug("sending message to ", this.activeConversation);

    this.socket.send(
      JSON.stringify({
        event: "send-message",
        message: message,
        roomName: this.activeConversation,
      })
    );
    this.input.value = "";
  }

  addConversation(roomName: string): void {
    if (this.activeConversations.has(roomName)) {
      this.setActiveConversation(roomName);
      return;
    }

    if (this.activeConversations.size >= this.maxConversations) {
      const oldestRoom = this.windowOrder[0];
      this.removeConversation(oldestRoom);
      this.windowOrder = this.windowOrder.slice(1);
    }

    const conversationWindow = new ConversationWindow(
      roomName,
      (name) => this.removeConversation(name),
      (name) => this.setActiveConversation(name),
      this.socket,
      this.currentUsername
    );

    this.activeConversations.set(roomName, conversationWindow);
    this.windowOrder.push(roomName);
    this.container.insertBefore(
      conversationWindow.element,
      this.container.lastChild
    );
    this.updateLayout();

    this.socket.send(
      JSON.stringify({
        event: "join-room",
        roomName: roomName,
      })
    );
  }

  addMessageHistory(roomName: string, messages: any[]): void {
    const conversation = this.activeConversations.get(roomName);
    if (conversation) {
      conversation.clearMessages();
      messages.forEach((msg) => conversation.addMessage(msg));
    }
  }

  removeConversation(roomName: string): void {
    const conversation = this.activeConversations.get(roomName);

    if (conversation) {
      conversation.element.remove();
      this.activeConversations.delete(roomName);
      this.windowOrder = this.windowOrder.filter((name) => name !== roomName);

      if (this.activeConversation === roomName) {
        const remainingRooms = Array.from(this.activeConversations.keys());
        if (remainingRooms.length > 0) {
          this.setActiveConversation(remainingRooms[0]);
        } else {
          this.setActiveConversation(null);
        }
      }

      this.updateLayout();
    }
  }

  setActiveConversation(roomName: string | null): void {
    this.activeConversations.forEach((conversation) => {
      conversation.element.classList.remove("active");
    });

    document.querySelectorAll("#cabals li").forEach((item) => {
      item.classList.remove("active");
    });

    this.activeConversation = roomName;

    if (roomName && this.activeConversations.has(roomName)) {
      const conversation = this.activeConversations.get(roomName);
      if (!conversation) return;

      this.input.disabled = false;
      this.sendButton.disabled = false;
      this.input.placeholder = `Message ${roomName}...`;

      conversation.element.classList.add("active");

      const roomButton = Array.from(
        document.querySelectorAll("#cabals li")
      ).find((item) => item.textContent?.startsWith(roomName));

      if (roomButton) {
        roomButton.classList.add("active");
      }

      this.socket.send(
        JSON.stringify({
          event: "join-room",
          roomName: roomName,
        })
      );

      this.input.focus();
    } else {
      this.input.disabled = true;
      this.sendButton.disabled = true;
      this.input.placeholder = "Select a conversation...";
    }
  }

  private updateLayout(): void {
    this.container.classList.remove("grid-1", "grid-2", "grid-3", "grid-4");
    if (this.activeConversations.size > 0) {
      const gridClass = `grid-${this.activeConversations.size}`;
      this.container.classList.add(gridClass);
      this.inputArea.style.display = "flex";
    } else {
      this.inputArea.style.display = "none";
    }
  }

  addMessage(
    roomName: string,
    username: string,
    avatar_url: string,
    content: string,
    messageId: string
  ): void {
    if (!this.activeConversations.has(roomName)) {
      this.addConversation(roomName);
    }

    const conversation = this.activeConversations.get(roomName);
    if (conversation) {
      const messageData = {
        id: messageId,
        username: username,
        avatar_url: avatar_url,
        content: content,
        timestamp: Date.now(),
        roomName: roomName,
      };

      conversation.addMessage(messageData);

      if (roomName !== this.activeConversation) {
        conversation.element.classList.add("has-unread");
      }

      conversation.element.classList.add("message-received");
      setTimeout(() => {
        conversation.element.classList.remove("message-received");
      }, 300);
    }
  }
}
