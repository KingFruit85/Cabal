export class ConversationWindow {
  constructor(cabalName, onClose, onActivate, socket, currentUsername) {
    this.cabalName = cabalName;
    this.onClose = onClose;
    this.onActivate = onActivate;
    this.socket = socket;
    this.currentUsername = currentUsername;
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

  addMessage(messageData) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    messageDiv.dataset.messageId = messageData.id; // Store message ID in DOM

    // Format the timestamp
    let timeString = "Unknown time";
    const timestamp = new Date(messageData.timestamp);
    timeString = timestamp.toLocaleTimeString();

    messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username">${this.escapeHtml(
                  messageData.username
                )}</span>
                <span class="timestamp">${timeString}</span>
                ${
                  messageData.edited
                    ? '<span class="edited">(edited)</span>'
                    : ""
                }
            </div>
            <div class="content">
                ${this.escapeHtml(messageData.message)}
            </div>
        `;

    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addMessageHistory(messages) {
    this.clearMessages();
    messages.forEach((msg) => this.addMessage(msg));
  }

  saveEdit(messageId, newText) {
    this.socket.send(
      JSON.stringify({
        event: "edit-message",
        id: messageId,
        message: newText,
      })
    );
  }

  deleteMessage(messageId) {
    if (confirm("Are you sure you want to delete this message?")) {
      this.socket.send(
        JSON.stringify({
          event: "delete-message",
          id: messageId,
        })
      );
    }
  }

  handleMessageUpdate(id, newMessage) {
    const messageDiv = this.messageContainer.querySelector(
      `[data-message-id="${id}"]`
    );
    if (messageDiv) {
      const content = messageDiv.querySelector(".content");
      content.textContent = newMessage;

      if (!messageDiv.querySelector(".edited")) {
        messageDiv
          .querySelector(".message-header")
          .insertAdjacentHTML(
            "beforeend",
            '<span class="edited">(edited)</span>'
          );
      }
    }
  }

  handleMessageDelete(id) {
    const messageDiv = this.messageContainer.querySelector(
      `[data-message-id="${id}"]`
    );
    if (messageDiv) {
      const content = messageDiv.querySelector(".content");
      content.textContent = "This message was deleted";
      content.classList.add("deleted");

      // Remove edit/delete buttons
      const actions = messageDiv.querySelector(".message-actions");
      if (actions) actions.remove();
    }
  }

  isOwnMessage(username) {
    return username === this.currentUsername;
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
    if (!unsafe) return ""; // Return empty string if input is undefined/null
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
