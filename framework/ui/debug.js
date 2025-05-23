import { escapeHTML } from './history.js';

// Placeholder for captured logs/errors
let debugLogs = [];

export function renderDebugPanel(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <span style="font-weight:bold; font-size:1.1em;">Console</span>
        <button id="debug-clear-btn" style="font-size:14px;">Clear</button>
      </div>
      <div id="debug-log-area" style="flex:1 1 0; min-height:0; max-height:none; overflow:auto; background:#181818; color:#eee; font-family:monospace; font-size:13px; border-radius:6px; padding:8px; border:1px solid #222;"></div>
    </div>
  `;
  const logArea = container.querySelector('#debug-log-area');
  const clearBtn = container.querySelector('#debug-clear-btn');
  function renderLogs() {
    logArea.innerHTML = debugLogs.map(entry => `<div style="white-space:pre-wrap; color:${entry.type==='error'?'#ff6b6b':'#eee'};">${escapeHTML(entry.text)}</div>`).join('');
    logArea.scrollTop = logArea.scrollHeight;
  }
  clearBtn.onclick = () => {
    debugLogs = [];
    renderLogs();
  };
  renderLogs();
}

// Utility to add a log entry
export function addDebugLog(text, type = 'log') {
  debugLogs.push({ text, type });
  if (debugLogs.length > 500) debugLogs.shift();
  // If the debug panel is visible, re-render it
  const panel = document.querySelector('#autoregret-shadow-host');
  if (panel && panel.shadowRoot) {
    const tab = panel.shadowRoot.querySelector('.tab[data-tab="debug"]');
    if (type === 'error' && tab) {
      // Blip effect: add a class to the tab for 5 seconds
      tab.classList.add('blip');
      setTimeout(() => {
        tab.classList.remove('blip');
      }, 5000);
    }
    if (tab && tab.classList.contains('active')) {
      const content = panel.shadowRoot.getElementById('tab-content');
      if (content) renderDebugPanel(content);
    }
  }
} 