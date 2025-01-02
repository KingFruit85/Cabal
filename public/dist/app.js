var p=class{roomName;onClose;onActivate;socket;currentUsername;element;messageContainer;unreadCount;constructor(e,t,s,o,d){this.roomName=e,this.onClose=t,this.onActivate=s,this.socket=o,this.currentUsername=d,this.element=this.createElement(),this.messageContainer=this.element.querySelector(".messages"),this.unreadCount=0,this.setupEventListeners()}clearMessages(){this.messageContainer.innerHTML="",this.unreadCount=0,this.updateUnreadCount()}createElement(){let e=document.createElement("div");return e.className="conversation-window",e.innerHTML=`
      <div class="window-header">
        <h3 data-unread="0">${this.roomName}</h3>
        <button class="close-btn" aria-label="Close conversation">\xD7</button>
      </div>
      <div class="messages"></div>
    `,e}setupEventListeners(){this.element.addEventListener("click",t=>{t.target.closest(".close-btn")||(this.clearUnread(),this.onActivate(this.roomName),this.addMessageHistory)});let e=this.element.querySelector(".close-btn");e&&e.addEventListener("click",t=>{t.stopPropagation(),this.onClose(this.roomName)})}addMessage(e){let t=document.createElement("div");t.className="message",t.dataset.messageId=e.id;let s="Unknown time",o=new Date(e.timestamp),d=e.avatar_url||"/img/default-avatar.png";s=o.toLocaleTimeString();let c=this.isOwnMessage(e.username)?`
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
        `:"";if(t.innerHTML=`
    <div class="message-wrapper">
    <img id="message-user-avatar" src="${d}" alt="User Avatar" />
      <div>
        <div class="message-header">
        <span class="username">${this.escapeHtml(e.username)}</span>
        <span class="timestamp">${s}</span>
        <span class="message-controls">${c}</span>
        </div>
        <div class="content">
        ${this.escapeHtml(e.content)}
        </div>
      </div>  
    </div>
    `,this.messageContainer.appendChild(t),this.isOwnMessage(e.username)){let m=t.querySelector(".edit-btn"),g=t.querySelector(".delete-btn");m?.addEventListener("click",u=>{u.stopPropagation(),this.handleMessageUpdate(e.id,"update")}),g?.addEventListener("click",u=>{u.stopPropagation(),this.deleteMessage(e.id)})}this.scrollToBottom()}addMessageHistory(e){this.clearMessages();for(let t=0;t<=e.length;t++)this.addMessage(e[t])}saveEdit(e,t){this.socket.send(JSON.stringify({event:"edit-message",id:e,message:t}))}deleteMessage(e){confirm("Are you sure you want to delete this message?")&&this.socket.send(JSON.stringify({event:"delete-message",messageId:e}))}handleMessageUpdate(e,t){let s=this.messageContainer.querySelector(`[data-message-id="${e}"]`);if(s){let o=s.querySelector(".content");o&&(o.textContent=t,s.querySelector(".edited")||s.querySelector(".message-header")?.insertAdjacentHTML("beforeend",'<span class="edited">(edited)</span>'))}}handleMessageDelete(e){let t=this.messageContainer.querySelector(`[data-message-id="${e}"]`);t&&t.remove()}isOwnMessage(e){return e===this.currentUsername}updateUnreadCount(){let e=this.element.querySelector(".window-header h3");e&&(this.unreadCount>0?(e.setAttribute("data-unread",this.unreadCount.toString()),this.element.classList.add("has-unread")):(e.setAttribute("data-unread","0"),this.element.classList.remove("has-unread")))}clearUnread(){this.unreadCount=0,this.updateUnreadCount()}scrollToBottom(){this.messageContainer.scrollTop=this.messageContainer.scrollHeight}escapeHtml(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}};var f=class{socket;currentUsername;activeConversations;windowOrder;container;maxConversations;activeConversation;inputArea;input;sendButton;constructor(e,t){this.socket=e,this.currentUsername=t,this.activeConversations=new Map,this.inputArea=document.createElement("div"),this.inputArea.className="input-area",this.input=document.createElement("input"),this.input.type="text",this.input.className="message-input",this.sendButton=document.createElement("button"),this.sendButton.className="send-button",this.sendButton.textContent="Send",this.windowOrder=[];let s=document.getElementById("multi-conversation-layout");if(!s)throw new Error("Container element not found");this.container=s,this.container.innerHTML="",this.maxConversations=4,this.activeConversation=null,this.setupInput(),this.setupStyles()}setupStyles(){this.container.classList.add("conversation-grid")}setupInput(){let e=document.createElement("div");e.className="global-input-area",e.style.display="none",e.innerHTML=`
      <input 
        type="text" 
        class="global-message-input" 
        placeholder="Select a conversation..." 
        disabled
      >
      <button class="global-send-btn" disabled>Send</button>
    `;let t=document.querySelector("main");if(!t)throw new Error("Main element not found");t.appendChild(e),this.inputArea=e,this.input=e.querySelector(".global-message-input"),this.sendButton=e.querySelector(".global-send-btn"),this.input.addEventListener("keypress",s=>{s.key==="Enter"&&this.input.value.trim()&&this.sendMessage(this.input.value.trim())}),this.sendButton.addEventListener("click",()=>{this.input.value.trim()&&this.sendMessage(this.input.value.trim())})}sendMessage(e){this.activeConversation&&this.activeConversations.has(this.activeConversation)&&(console.log(JSON.stringify({message:e})),console.debug("sending message to ",this.activeConversation),this.socket.send(JSON.stringify({event:"send-message",message:e,roomName:this.activeConversation})),this.input.value="")}addConversation(e){if(this.activeConversations.has(e)){this.setActiveConversation(e);return}if(this.activeConversations.size>=this.maxConversations){let s=this.windowOrder[0];this.removeConversation(s),this.windowOrder=this.windowOrder.slice(1)}let t=new p(e,s=>this.removeConversation(s),s=>this.setActiveConversation(s),this.socket,this.currentUsername);this.activeConversations.set(e,t),this.windowOrder.push(e),this.container.insertBefore(t.element,this.container.lastChild),this.updateLayout(),this.socket.send(JSON.stringify({event:"join-room",roomName:e}))}addMessageHistory(e,t){let s=this.activeConversations.get(e);s&&(s.clearMessages(),t.forEach(o=>s.addMessage(o)))}removeConversation(e){let t=this.activeConversations.get(e);if(t){if(t.element.remove(),this.activeConversations.delete(e),this.windowOrder=this.windowOrder.filter(s=>s!==e),this.activeConversation===e){let s=Array.from(this.activeConversations.keys());s.length>0?this.setActiveConversation(s[0]):this.setActiveConversation(null)}this.updateLayout()}}setActiveConversation(e){if(this.activeConversations.forEach(t=>{t.element.classList.remove("active")}),document.querySelectorAll("#cabals li").forEach(t=>{t.classList.remove("active")}),this.activeConversation=e,e&&this.activeConversations.has(e)){let t=this.activeConversations.get(e);if(!t)return;this.input.disabled=!1,this.sendButton.disabled=!1,this.input.placeholder=`Message ${e}...`,t.element.classList.add("active");let s=Array.from(document.querySelectorAll("#cabals li")).find(o=>o.textContent?.startsWith(e));s&&s.classList.add("active"),this.socket.send(JSON.stringify({event:"join-room",roomName:e})),this.input.focus()}else this.input.disabled=!0,this.sendButton.disabled=!0,this.input.placeholder="Select a conversation..."}updateLayout(){if(this.container.classList.remove("grid-1","grid-2","grid-3","grid-4"),this.activeConversations.size>0){let e=`grid-${this.activeConversations.size}`;this.container.classList.add(e),this.inputArea.style.display="flex"}else this.inputArea.style.display="none"}addMessage(e,t,s,o,d){this.activeConversations.has(e)||this.addConversation(e);let c=this.activeConversations.get(e);if(c){let m={id:d,username:t,avatar_url:s,content:o,timestamp:Date.now(),roomName:e};c.addMessage(m),e!==this.activeConversation&&c.element.classList.add("has-unread"),c.element.classList.add("message-received"),setTimeout(()=>{c.element.classList.remove("message-received")},300)}}};var C=class{element;constructor(){this.element=document.createElement("div"),this.element.className="context-menu",document.body.appendChild(this.element)}show(e){this.element.style.left=`${e.x}px`,this.element.style.top=`${e.y}px`,this.element.innerHTML="",e.items.forEach(t=>{let s=document.createElement("div");s.className="context-menu-item",s.textContent=t.label,s.onclick=()=>{t.action(),this.hide()},this.element.appendChild(s)}),this.element.style.display="block"}hide(){this.element.style.display="none"}};function L(i){console.log(i);let e=new URL(`./start_web_socket?username=${i.login}`,location.href);e.protocol=e.protocol.replace("http","ws");let t=new WebSocket(e.href),s=new f(t,i.login),o=new C;document.addEventListener("click",()=>o.hide());let d=document.getElementById("username-display");d&&(d.textContent=i.login);let c=document.getElementById("user-avatar");c&&(c.src=i.avatar_url);let m=null;t.onerror=r=>{console.error("WebSocket error:",r)},t.onclose=r=>{console.log("WebSocket closed:",r.code,r.reason)},t.onmessage=r=>{console.log("Received WebSocket message:",r.data);let n=JSON.parse(r.data);switch(n.event){case"update-users":u(n.usernames);break;case"update-rooms":m=n.rooms,g(n.rooms);break;case"new-message":s.addMessage(n.message.roomName,n.message.username,n.message.avatar_url,n.message.content,n.message.id);break;case"room-history":s.addMessageHistory(n.roomName,n.messages);break;case"edit-message":{let a=s.activeConversations.get(n.roomName);a&&a.handleMessageUpdate(n.id,n.message);break}case"delete-message":{let a=s.activeConversations.get(n.roomName);a&&a.handleMessageDelete(n.id);break}case"error":console.error("Server error:",n.message),alert(n.message);break;case"expired":console.info("Handling expired room:",n.roomName),s.removeConversation(n.roomName);break}},setInterval(()=>{m&&g(m)},1e3);function g(r){let n=document.querySelector("#cabals");if(n){n.replaceChildren();for(let a of r){let l=document.createElement("li");l.textContent=`${a.name}`;let h=Date.now()-a.lastActivity,v=Math.min(h/a.ttl,1),E=Math.round(26+102*v),y=Math.round(26+-26*v),M=Math.round(29+3*v);l.style.backgroundColor=`rgb(${E}, ${y}, ${M})`,s.activeConversation===a.name&&l.classList.add("active"),l.onclick=()=>{n.querySelectorAll("li").forEach(w=>{w.classList.remove("active")}),l.classList.add("active"),s.addConversation(a.name),s.setActiveConversation(a.name),t.send(JSON.stringify({event:"join-room",roomName:a.name}))},n.appendChild(l)}}}function u(r){let n=document.querySelector("#users");if(n){n.replaceChildren();for(let a of r){if(a===i.login)continue;let l=document.createElement("li");l.textContent=a,l.addEventListener("contextmenu",h=>{h.preventDefault(),o.show({x:h.pageX,y:h.pageY,items:[{label:"Confer",action:()=>{let v=`A colloquy between ${[i.login,a].sort().join(" and ")}`;t.send(JSON.stringify({event:"create-private-chat",participants:[i.login,a],roomName:v})),s.addConversation(v)}}]})}),n.appendChild(l)}}}let b=document.querySelector("#create-cabal");b&&(b.onclick=()=>{let r=prompt("Enter cabal name:");if(r){let n={roomName:r,roomType:"cabal",initialMembers:[i.login]};t.send(JSON.stringify({event:"create-room",...n}))}})}async function k(){try{let i=await fetch("/api/auth");return i.status===401?(globalThis.location.href="/signin",null):await i.json()}catch(i){return console.error("Auth check failed:",i),globalThis.location.href="/signin",null}}async function S(){let i=await k();i&&i&&await L(i)}S();
//# sourceMappingURL=app.js.map
