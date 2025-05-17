// Minimal User App Entry Point
export const App = {
  init() {
    const root = document.getElementById('autoregret-root');
    if (!root) return;
    root.innerHTML = `<h2>Welcome to AutoRegret</h2>`;
  }
}; 