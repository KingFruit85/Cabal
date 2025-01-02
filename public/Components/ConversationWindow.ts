interface MessageData {
  id: string;
  username: string;
  avatar_url: string;
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
    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    messageDiv.dataset.messageId = messageData.id;

    let timeString = "Unknown time";
    const timestamp = new Date(messageData.timestamp);
    const avatarUrl = messageData.avatar_url || "/img/default-avatar.png";
    timeString = timestamp.toLocaleTimeString();

    // Add controls if the message is from current user
    const controls = this.isOwnMessage(messageData.username)
      ? `
          <button class="delete-btn" aria-label="Delete message">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
          <button class="edit-btn" aria-label="Edit message">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </button>
        `
      : "";

    messageDiv.innerHTML = `
    <div class="message-wrapper">
    <img id="message-user-avatar" src="${avatarUrl}" alt="User Avatar" />
      <div>
        <div class="message-header">
        <span class="username">${this.escapeHtml(messageData.username)}</span>
        <span class="timestamp">${timeString}</span>
        <span class="message-controls">${controls}</span>
        </div>
        <div class="content">
        ${this.escapeHtml(messageData.content)}
        </div>
      </div>  
    </div>
    `;

    this.messageContainer.appendChild(messageDiv);

    if (this.isOwnMessage(messageData.username)) {
      const editBtn = messageDiv.querySelector(".edit-btn");
      const deleteBtn = messageDiv.querySelector(".delete-btn");

      editBtn?.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent message click event
        this.handleMessageUpdate(messageData.id, "update");
      });

      deleteBtn?.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent message click event
        this.deleteMessage(messageData.id);
      });
    }

    this.scrollToBottom();
  }

  addMessageHistory(messages: MessageData[]): void {
    this.clearMessages();

    for (let i = 0; i <= messages.length; i++) {
      this.addMessage(messages[i]);
    }
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
          messageId: messageId,
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

  handleMessageDelete(messageId: string): void {
    const messageDiv = this.messageContainer.querySelector(
      `[data-message-id="${messageId}"]`
    );

    if (messageDiv) {
      messageDiv.remove();
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
