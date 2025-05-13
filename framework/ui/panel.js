// Shadow UI Panel for AutoRegret
import { getApiKey, setApiKey, getModel, setModel } from '../core/gpt.js';
import { renderEditor } from './editor.js';
import { renderChat } from './chat.js';
import { renderHistory } from './history.js';

export function initPanel() {
  if (document.getElementById('autoregret-shadow-host')) return;
  const host = document.createElement('div');
  host.id = 'autoregret-shadow-host';
  host.style.position = 'fixed';
  host.style.top = '40px';
  host.style.right = '40px';
  host.style.zIndex = '99999';
  host.style.width = '400px';
  host.style.height = '700px';
  host.style.boxShadow = '0 2px 16px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.08)';
  host.style.borderRadius = '10px';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .panel-header { display: flex; align-items: center; justify-content: space-between; height: 48px; background: #f7faff; border-radius: 10px 10px 0 0; box-shadow: 0 2px 16px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.08); padding: 0 16px; border-bottom: 2px solid #dde3ec; font-weight: 600; font-size: 16px; letter-spacing: 0.5px; position: relative; z-index: 10; margin-bottom: 8px; }
      .panel-header-title { color: #007aff; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }
      .settings-btn, .purge-btn { background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 18px; margin-left: 8px; box-shadow: 0 1px 2px #e0e6ef; transition: background 0.2s; position: static; }
      .settings-btn:hover, .purge-btn:hover { background: #f0f4fa; }
      .auto-apply-toggle { margin-left: 12px; display: inline-flex; align-items: center; font-size: 14px; user-select: none; }
      .auto-apply-toggle input[type='checkbox'] { accent-color: #007aff; margin-right: 4px; }
      .tabs { display: flex; }
      .tab { flex: 1; padding: 8px; cursor: pointer; background: #eee; border-bottom: 2px solid transparent; text-align: center; }
      .tab.active { background: #fff; border-bottom: 2px solid #007aff; }
      .tab-content { padding: 16px; background: #fff; height: 620px; overflow: auto; border-radius: 0 0 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); border-bottom: 2px solid #dde3ec; }
      .settings-modal {
        position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;
        z-index: 100000;
      }
      .settings-content {
        background: #fff; padding: 24px; border-radius: 8px; min-width: 320px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.2);
      }
      .settings-content label { display: block; margin-top: 12px; }
      .settings-content input { width: 100%; margin-top: 4px; padding: 6px; }
      .settings-content button { margin-top: 16px; }
      .minimized {
        height: 48px !important;
        min-height: 0 !important;
        max-height: 48px !important;
        width: 140px !important;
        min-width: 0 !important;
        max-width: 140px !important;
        overflow: hidden !important;
        transition: height 0.2s, width 0.2s, border-radius 0.2s;
        border-radius: 10px !important;
      }
      .minimized .tabs,
      .minimized .tab-content,
      .minimized #settings-modal {
        display: none !important;
      }
      .minimized .panel-header {
        justify-content: center !important;
        overflow: visible !important;
      }
      .minimized .panel-header-title {
        width: 100%; text-align: center; padding: 0 12px; overflow: visible;
      }
      .minimized .panel-header > div,
      .minimized .auto-apply-toggle,
      .minimized .settings-btn,
      .minimized .purge-btn {
        display: none !important;
      }
    </style>
    <div id="panel-wrapper">
      <div class="panel-header">
        <span class="panel-header-title" style="cursor:pointer; display:flex; align-items:center; gap:6px;" title="Minimize/Expand">
          AutoRegret
          <span id="minimize-chevron" style="font-size:18px; transition: transform 0.2s;">▼</span>
        </span>
        <div style="display:flex; align-items:center;">
          <label class="auto-apply-toggle" title="Automatically apply chat suggestions">
            <input type="checkbox" id="auto-apply-toggle" checked /> Auto-Apply
          </label>
          <button class="purge-btn" title="Purge DB">🗑️</button>
          <button class="settings-btn" title="Settings">⚙️</button>
        </div>
      </div>
      <div class="tabs">
        <div class="tab" data-tab="editor">Editor</div>
        <div class="tab" data-tab="chat">Chat</div>
        <div class="tab" data-tab="history">History</div>
      </div>
      <div class="tab-content" id="tab-content"></div>
      <div id="settings-modal" style="display:none"></div>
    </div>
  `;
  const autoApplyToggle = shadow.getElementById('auto-apply-toggle');
  let autoApply = true;
  let currentTab = 'chat';
  let minimized = false;

  autoApplyToggle.onchange = () => {
    autoApply = autoApplyToggle.checked;
    // If currently on the chat tab, re-render it with the new autoApply value
    if (currentTab === 'chat') {
      renderTab('chat');
    }
  };

  const tabs = shadow.querySelectorAll('.tab');
  const content = shadow.getElementById('tab-content');

  function setActiveTab(tabName) {
    currentTab = tabName;
    tabs.forEach(t => {
      if (t.getAttribute('data-tab') === tabName) t.classList.add('active');
      else t.classList.remove('active');
    });
    renderTab(tabName);
  }

  function renderTab(tabName) {
    content.innerHTML = '';
    if (tabName === 'editor') renderEditor(content);
    else if (tabName === 'chat') {
      renderChat(content, { autoApply });
      // Focus the chat input after rendering
      setTimeout(() => {
        const input = content.querySelector('#chat-input');
        if (input) input.focus();
      }, 0);
    }
    else if (tabName === 'history') renderHistory(content);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveTab(tab.getAttribute('data-tab'));
    });
  });
  setActiveTab(currentTab);

  // Expose a global function for chat-to-diff workflow
  window.autoregretSendToDiff = function() {};

  // Settings modal logic
  const settingsBtn = shadow.querySelector('.settings-btn');
  const purgeBtn = shadow.querySelector('.purge-btn');
  const settingsModal = shadow.getElementById('settings-modal');
  settingsBtn.onclick = () => {
    const currentKey = getApiKey();
    const currentModel = getModel();
    settingsModal.innerHTML = `
      <div class="settings-modal">
        <div class="settings-content">
          <h3>OpenAI Settings</h3>
          <label>API Key
            <input type="password" id="api-key-input" value="${currentKey}" placeholder="sk-..." autocomplete="off" />
          </label>
          <label>Model
            <input type="text" id="model-input" value="${currentModel}" placeholder="gpt-4.1" />
          </label>
          <button id="save-settings">Save</button>
          <button id="close-settings" style="margin-left:8px">Cancel</button>
        </div>
      </div>
    `;
    settingsModal.style.display = '';
    shadow.getElementById('save-settings').onclick = () => {
      const key = shadow.getElementById('api-key-input').value.trim();
      const model = shadow.getElementById('model-input').value.trim();
      setApiKey(key);
      setModel(model);
      settingsModal.style.display = 'none';
      // Re-render chat tab if it's active
      if (currentTab === 'chat') renderTab('chat');
    };
    shadow.getElementById('close-settings').onclick = () => {
      settingsModal.style.display = 'none';
    };
  };
  purgeBtn.onclick = async () => {
    if (!confirm('Purge all app data and restore to original state? This cannot be undone.')) return;
    // Preserve OpenAI API key and model
    const apiKey = localStorage.getItem('autoregret_openai_api_key');
    const model = localStorage.getItem('autoregret_openai_model');
    // Clear all localStorage
    localStorage.clear();
    // Restore API key and model
    if (apiKey) localStorage.setItem('autoregret_openai_api_key', apiKey);
    if (model) localStorage.setItem('autoregret_openai_model', model);
    // Delete IndexedDB
    const req = indexedDB.deleteDatabase('autoregret-files');
    req.onsuccess = req.onerror = req.onblocked = () => {
      location.reload();
    };
  };

  // Minimize/expand logic
  const panelWrapper = shadow.getElementById('panel-wrapper');
  const panelHeaderTitle = shadow.querySelector('.panel-header-title');
  const chevron = shadow.getElementById('minimize-chevron');
  panelHeaderTitle.onclick = () => {
    minimized = !minimized;
    if (minimized) {
      host.style.height = '48px';
      host.style.width = '140px';
      host.style.borderRadius = '10px';
      panelWrapper.classList.add('minimized');
      chevron.textContent = '▲';
    } else {
      host.style.height = '700px';
      host.style.width = '400px';
      host.style.borderRadius = '10px 10px 10px 10px';
      panelWrapper.classList.remove('minimized');
      chevron.textContent = '▼';
    }
  };

  // TODO: Make panel draggable
} 