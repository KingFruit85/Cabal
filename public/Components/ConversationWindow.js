export class ConversationWindow {
  constructor(cabalName, onClose, onActivate) {
    this.cabalName = cabalName;
    this.onClose = onClose;
    this.onActivate = onActivate;
    this.element = this.createElement();
    this.messageContainer = this.element.querySelector(".messages");
    this.unreadCount = 0;
    this.setupEventListeners();
  }

  clearMessages() {
    this.messageContainer.innerHTML = "";
    this.unreadCount = 0;
    this.updateUnreadCount();
  }

  createElement() {
    const div = document.createElement("div");
    div.className = "conversation-window";
    div.innerHTML = `
      <div class="window-header">
        <h3 data-unread="0">${this.cabalName}</h3>
        <button class="close-btn" aria-label="Close conversation">×</button>
      </div>
      <div class="messages"></div>
    `;
    return div;
  }

  setupEventListeners() {
    // Handle window clicks
    this.element.addEventListener("click", (e) => {
      console.log("Conversation window clicked:", this.cabalName);
      // Don't activate if clicking close button
      if (!e.target.closest(".close-btn")) {
        this.clearUnread();
        this.onActivate(this.cabalName);
      }
    });

    // Handle close button separately
    const closeBtn = this.element.querySelector(".close-btn");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onClose(this.cabalName);
    });
  }

  addMessage(username, message) {
    // Check if we need to add a time separator
    const now = new Date();
    const lastMessage = this.messageContainer.lastElementChild;

    if (lastMessage) {
      const lastTime = lastMessage.dataset.timestamp;
      const timeDiff = now - new Date(lastTime);

      // Add separator if more than 5 minutes between messages
      if (timeDiff > 5 * 60 * 1000) {
        const separator = document.createElement("div");
        separator.className = "time-separator";
        separator.textContent = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        this.messageContainer.appendChild(separator);
      }
    }

    const messageDiv = document.createElement("div");
    const isCurrentUser = username === this.getCurrentUsername();

    messageDiv.className = `message ${isCurrentUser ? "sent" : "received"}`;
    messageDiv.dataset.timestamp = now.toISOString();

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="username">${this.escapeHtml(username)}</span>
            <span class="timestamp">${now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}</span>
        </div>
        <div class="content">${this.escapeHtml(message)}</div>
    `;

    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();

    if (!this.element.classList.contains("active")) {
      this.unreadCount++;
      this.updateUnreadCount();
    }
  }

  getCurrentUsername() {
    // You'll need to pass the current username to the ConversationWindow
    // or access it from a global variable/state
    return globalThis.myUsername; // This should match the username you set when connecting
  }

  updateUnreadCount() {
    const header = this.element.querySelector(".window-header h3");
    if (this.unreadCount > 0) {
      header.setAttribute("data-unread", this.unreadCount);
      this.element.classList.add("has-unread");
    } else {
      header.setAttribute("data-unread", "0");
      this.element.classList.remove("has-unread");
    }
  }

  clearUnread() {
    this.unreadCount = 0;
    this.updateUnreadCount();
  }

  scrollToBottom() {
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
