// User App Entry Point
export const App = {
  init() {
    const root = document.getElementById('autoregret-root');
    if (!root) return;
    root.innerHTML = `
      <h1>Welcome to AutoRegret</h1>
      <button id="hello-btn">Click Me</button>
    `;
    document.getElementById('hello-btn').onclick = () => {
      console.log('Button clicked!');
    };
  }
}; 