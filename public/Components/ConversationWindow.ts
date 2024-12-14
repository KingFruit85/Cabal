interface MessageData {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  roomName: string;
  edited?: boolean;
}

export class ConversationWindow {
  private roomName: string;
  private onClose: (name: string) => void;
  private onActivate: (name: string) => void;
  private socket: WebSocket;
  private currentUsername: string;
  public element: HTMLDivElement;
  private messageContainer: HTMLDivElement;
  private unreadCount: number;

  constructor(
    roomName: string,
    onClose: (name: string) => void,
    onActivate: (name: string) => void,
    socket: WebSocket,
    currentUsername: string
  ) {
    this.roomName = roomName;
    this.onClose = onClose;
    this.onActivate = onActivate;
    this.socket = socket;
    this.currentUsername = currentUsername;
    this.element = this.createElement();
    this.messageContainer = this.element.querySelector(
      ".messages"
    ) as HTMLDivElement;
    this.unreadCount = 0;
    this.setupEventListeners();
  }

  clearMessages(): void {
    this.messageContainer.innerHTML = "";
    this.unreadCount = 0;
    this.updateUnreadCount();
  }

  private createElement(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "conversation-window";
    div.innerHTML = `
      <div class="window-header">
        <h3 data-unread="0">${this.roomName}</h3>
        <button class="close-btn" aria-label="Close conversation">×</button>
      </div>
      <div class="messages"></div>
    `;
    return div;
  }

  private setupEventListeners(): void {
    this.element.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".close-btn")) {
        this.clearUnread();
        this.onActivate(this.roomName);
        this.addMessageHistory;
      }
    });

    const closeBtn = this.element.querySelector(".close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        this.onClose(this.roomName);
      });
    }
  }

  addMessage(messageData: MessageData): void {
    console.log("in add message");
    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    messageDiv.dataset.messageId = messageData.id;

    let timeString = "Unknown time";
    const timestamp = new Date(messageData.timestamp);
    timeString = timestamp.toLocaleTimeString();

    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="username">${this.escapeHtml(messageData.username)}</span>
        <span class="timestamp">${timeString}</span>
        ${messageData.edited ? '<span class="edited">(edited)</span>' : ""}
      </div>
      <div class="content">
        ${this.escapeHtml(messageData.content)}
      </div>
    `;

    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addMessageHistory(messages: MessageData[]): void {
    this.clearMessages();

    for (let i = 0; i <= messages.length; i++) {
      console.log(messages[i].content);
      this.addMessage(messages[i]);
    }

    // messages.forEach((msg) => this.addMessage(msg));
  }

  saveEdit(messageId: string, newText: string): void {
    this.socket.send(
      JSON.stringify({
        event: "edit-message",
        id: messageId,
        message: newText,
      })
    );
  }

  deleteMessage(messageId: string): void {
    if (confirm("Are you sure you want to delete this message?")) {
      this.socket.send(
        JSON.stringify({
          event: "delete-message",
          id: messageId,
        })
      );
    }
  }

  handleMessageUpdate(id: string, newMessage: string): void {
    const messageDiv = this.messageContainer.querySelector(
      `[data-message-id="${id}"]`
    );
    if (messageDiv) {
      const content = messageDiv.querySelector(".content");
      if (content) {
        content.textContent = newMessage;

        if (!messageDiv.querySelector(".edited")) {
          messageDiv
            .querySelector(".message-header")
            ?.insertAdjacentHTML(
              "beforeend",
              '<span class="edited">(edited)</span>'
            );
        }
      }
    }
  }

  handleMessageDelete(id: string): void {
    const messageDiv = this.messageContainer.querySelector(
      `[data-message-id="${id}"]`
    );
    if (messageDiv) {
      const content = messageDiv.querySelector(".content");
      if (content) {
        content.textContent = "This message was deleted";
        content.classList.add("deleted");

        const actions = messageDiv.querySelector(".message-actions");
        if (actions) actions.remove();
      }
    }
  }

  isOwnMessage(username: string): boolean {
    return username === this.currentUsername;
  }

  private updateUnreadCount(): void {
    const header = this.element.querySelector(".window-header h3");
    if (header) {
      if (this.unreadCount > 0) {
        header.setAttribute("data-unread", this.unreadCount.toString());
        this.element.classList.add("has-unread");
      } else {
        header.setAttribute("data-unread", "0");
        this.element.classList.remove("has-unread");
      }
    }
  }

  clearUnread(): void {
    this.unreadCount = 0;
    this.updateUnreadCount();
  }

  private scrollToBottom(): void {
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }

  private escapeHtml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
