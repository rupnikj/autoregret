// User App Entry Point
export const App = {
  init() {
    const root = document.getElementById('autoregret-root');
    if (!root) return;
    root.innerHTML = `
      <h1>Welcome to AutoRegret</h1>
      <button id="hello-btn">Click Me</button>
      <div id="fun-message" style="margin-top:20px;font-size:1.2em;"></div>
    `;
    document.getElementById('hello-btn').onclick = function() {
      this.textContent = "Hey you! 🥴";
      const msgDiv = document.getElementById('fun-message');
      if (msgDiv) {
        msgDiv.innerHTML = "Go to <span id='goto-chat' style='color:#007aff; cursor:pointer; text-decoration:underline;'>Chat</span> tab and ask `remove the drunk button`";
        const chatSpan = document.getElementById('goto-chat');
        if (chatSpan && window.parent) {
          chatSpan.onclick = () => {
            // Try to open the Chat tab in the panel
            if (window.parent.document) {
              const shadowHost = window.parent.document.getElementById('autoregret-shadow-host');
              if (shadowHost && shadowHost.shadowRoot) {
                const chatTab = shadowHost.shadowRoot.querySelector('.tab[data-tab="chat"]');
                if (chatTab) chatTab.click();
              }
            }
          };
        }
      }
    };
  }
}; 