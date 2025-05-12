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
      .panel-header { display: flex; align-items: center; justify-content: space-between; height: 48px; background: #f7faff; border-radius: 10px 10px 0 0; box-shadow: 0 1px 0 #e0e6ef; padding: 0 16px; border-bottom: 2px solid #dde3ec; font-weight: 600; font-size: 16px; letter-spacing: 0.5px; position: relative; z-index: 10; margin-bottom: 8px; }
      .panel-header-title { color: #007aff; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }
      .settings-btn { background: #fff; border: 1px solid #ccc; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 18px; margin-left: 8px; box-shadow: 0 1px 2px #e0e6ef; transition: background 0.2s; position: static; }
      .settings-btn:hover { background: #f0f4fa; }
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
    </style>
    <div class="panel-header">
      <span class="panel-header-title">AutoRegret</span>
      <button class="settings-btn" title="Settings">⚙️</button>
    </div>
    <div class="tabs">
      <div class="tab" data-tab="editor">Editor</div>
      <div class="tab" data-tab="chat">Chat</div>
      <div class="tab" data-tab="history">History</div>
    </div>
    <div class="tab-content" id="tab-content"></div>
    <div id="settings-modal" style="display:none"></div>
  `;
  const tabs = shadow.querySelectorAll('.tab');
  const content = shadow.getElementById('tab-content');
  let currentTab = 'editor';

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
    else if (tabName === 'chat') renderChat(content);
    else if (tabName === 'history') renderHistory(content);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveTab(tab.getAttribute('data-tab'));
    });
  });
  setActiveTab('editor');

  // Expose a global function for chat-to-diff workflow
  window.autoregretSendToDiff = function() {};

  // Settings modal logic
  const settingsBtn = shadow.querySelector('.settings-btn');
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
            <input type="text" id="model-input" value="${currentModel}" placeholder="gpt-4-turbo" />
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
    };
    shadow.getElementById('close-settings').onclick = () => {
      settingsModal.style.display = 'none';
    };
  };
  // TODO: Make panel draggable
} 