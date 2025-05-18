// Shadow UI Panel for AutoRegret
import { getApiKey, setApiKey, getModel, setModel } from '../core/gpt.js';
import { renderEditor } from './editor.js';
import { renderChat } from './chat.js';
import { renderHistory } from './history.js';

function getAutoApply() {
  const val = localStorage.getItem('autoregret_auto_apply');
  return val === null ? true : val === 'true';
}
function setAutoApply(val) {
  localStorage.setItem('autoregret_auto_apply', !!val);
}

function getYoloAutoSend() {
  const val = localStorage.getItem('autoregret_yolo_autosend');
  return val === null ? true : val === 'true';
}
function setYoloAutoSend(val) {
  localStorage.setItem('autoregret_yolo_autosend', !!val);
}

function getShowWelcomeButton() {
  const val = localStorage.getItem('autoregret_show_welcome_button');
  return val === null ? true : val === 'true';
}
function setShowWelcomeButton(val) {
  localStorage.setItem('autoregret_show_welcome_button', !!val);
}

function getAllowExternalLibs() {
  const val = localStorage.getItem('autoregret_allow_external_libs');
  return val === 'true';
}
function setAllowExternalLibs(val) {
  localStorage.setItem('autoregret_allow_external_libs', !!val);
}

function getDiffOnly() {
  const val = localStorage.getItem('autoregret_diff_only');
  return val === 'true';
}
function setDiffOnly(val) {
  localStorage.setItem('autoregret_diff_only', !!val);
}

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
      .auto-apply-toggle { margin-left: 14px; display: inline-flex; align-items: center; font-size: 14px; user-select: none; }
      .auto-apply-toggle input[type='checkbox'] { accent-color: #007aff; margin-right: 4px; }
      .tabs { display: flex; }
      .tab { flex: 1; padding: 8px; cursor: pointer; background: #eee; border-bottom: 2px solid transparent; text-align: center; }
      .tab.active { background: #fff; border-bottom: 2px solid #007aff; }
      .tab-content {
        padding: 16px; background: #fff; height: 620px; overflow: auto; border-radius: 0 0 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); border-bottom: 2px solid #dde3ec;
        display: flex;
        flex-direction: column;
        overflow: hidden !important;
      }
      .tab-content > * {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
      }
      .settings-modal {
        position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;
        z-index: 100000;
      }
      .settings-content {
        background: #fff; padding: 24px; border-radius: 8px; min-width: 320px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.2);
        max-height: 80vh;
        overflow-y: auto;
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
      /* --- Mobile Responsive Styles --- */
      @media (max-width: 600px) {
        :host {
          left: 0 !important;
          top: 0 !important;
          right: 0 !important;
          width: 100vw !important;
          /* Use small viewport height for true fullscreen on mobile */
          height: 100svh !important;
          max-height: 100svh !important;
          min-height: 100svh !important;
          /* Fallback for browsers without svh support */
          height: 100vh !important;
          max-height: 100vh !important;
          min-height: 100vh !important;
          border-radius: 0 !important;
        }
        #panel-wrapper {
          border-radius: 0 !important;
        }
        .panel-header {
          border-radius: 0 !important;
        }
        .tab-content {
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        .tab-content > * {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
        }
        /* Sticky input bar for chat */
        #tab-content [id^='chat-input'],
        #tab-content [id^='chat-send'],
        #tab-content [id^='chat-mic'] {
          position: sticky !important;
          bottom: 0 !important;
          z-index: 2 !important;
          background: #fff !important;
        }
        .settings-modal {
          align-items: flex-start !important;
          justify-content: center !important;
          height: 100svh !important;
          min-height: 100svh !important;
          max-height: 100svh !important;
          /* fallback */
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
        }
        .settings-content {
          width: 98vw !important;
          min-width: unset !important;
          max-width: 100vw !important;
          max-height: 95svh !important;
          overflow-y: auto !important;
          padding: 12px !important;
          font-size: 1em !important;
        }
        #cm-save-bar {
          position: sticky;
          bottom: 0;
          background: #fff;
          z-index: 2;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        #cm-editor {
          min-height: 0 !important;
          max-height: 60vh !important;
          overflow-y: auto !important;
        }
        #history-status-bar {
          position: sticky;
          bottom: 0;
          background: #fff;
          z-index: 2;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        #history-list {
          min-height: 0 !important;
          max-height: 60vh !important;
          overflow-y: auto !important;
        }
        #chat-input-bar {
          position: sticky;
          bottom: 0;
          background: #fff;
          z-index: 2;
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        #chat-messages {
          min-height: 0 !important;
          max-height: 60vh !important;
          overflow-y: auto !important;
        }
      }
    </style>
    <div id="panel-wrapper">
      <div class="panel-header">
        <span class="panel-header-title" style="cursor:pointer; display:flex; align-items:center; gap:6px;" title="Minimize/Expand">
          AutoRegret
          <span id="minimize-chevron" style="font-size:18px; transition: transform 0.2s;">▲</span>
        </span>
        <div style="display:flex; align-items:center;">
          <button class="save-btn" title="Download as HTML" style="background:#fff; border:1px solid #ccc; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:18px; margin-left:8px; box-shadow:0 1px 2px #e0e6ef; transition:background 0.2s; position: static;">💾</button>
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
  const saveBtn = shadow.querySelector('.save-btn');
  let currentTab = 'chat';
  let minimized = false;

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
      renderChat(content, { autoApply: getAutoApply() });
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
    const currentAutoApply = getAutoApply();
    const currentYolo = getYoloAutoSend();
    const currentShowWelcomeBtn = getShowWelcomeButton();
    const currentAllowExternalLibs = getAllowExternalLibs();
    const currentDiffOnly = getDiffOnly();
    settingsModal.innerHTML = `
      <div class="settings-modal" tabindex="0">
        <form class="settings-content" id="settings-form" autocomplete="off" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 1.3em; font-weight: bold; margin-bottom: 8px;">Settings</div>
          <label>
            OpenAI API Key
            <input type="password" id="api-key-input" value="${currentKey}" placeholder="sk-..." autocomplete="off" />
          </label>
          <label>
            OpenAI Model
            <input type="text" id="model-input" value="${currentModel}" placeholder="gpt-4.1" />
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <input type="checkbox" id="auto-apply-setting" ${currentAutoApply ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span style="font-size: 1em;">Auto-Apply chat suggestions</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <input type="checkbox" id="yolo-autosend-setting" ${currentYolo ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span style="font-size: 1em;">YOLO: Auto-send after voice transcription</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <input type="checkbox" id="show-welcome-btn-setting" ${currentShowWelcomeBtn ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span style="font-size: 1em;">Show welcome button</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <input type="checkbox" id="allow-external-libs-setting" ${currentAllowExternalLibs ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span style="font-size: 1em;">Allow external libraries</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <input type="checkbox" id="diff-only-setting" ${currentDiffOnly ? 'checked' : ''} style="width: 18px; height: 18px;" />
            <span style="font-size: 1em;">Request diff/patch only from GPT</span>
          </label>
          <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button type="submit" id="save-settings">Save Settings</button>
            <button type="button" id="close-settings">Cancel Settings</button>
          </div>
          <hr style="margin: 18px 0 8px 0; border: none; border-top: 1px solid #eee;" />
          <div style="font-size: 1em; color: #888; margin-bottom: 4px;">Backup & Restore</div>
          <div style="display: flex; gap: 12px; margin-bottom: 8px;">
            <button type="button" id="export-state">Export App State</button>
            <button type="button" id="import-state">Import App State</button>
          </div>
          <input type="file" id="import-state-file" accept="application/json" style="display:none" />
        </form>
      </div>
    `;
    settingsModal.style.display = '';
    const modalDiv = shadow.querySelector('.settings-modal');
    if (modalDiv) modalDiv.focus();
    // Save handler
    shadow.getElementById('settings-form').onsubmit = (e) => {
      e.preventDefault();
      const key = shadow.getElementById('api-key-input').value.trim();
      const model = shadow.getElementById('model-input').value.trim();
      const autoApply = shadow.getElementById('auto-apply-setting').checked;
      const yoloAutoSend = shadow.getElementById('yolo-autosend-setting').checked;
      const showWelcomeBtn = shadow.getElementById('show-welcome-btn-setting').checked;
      const allowExternalLibs = shadow.getElementById('allow-external-libs-setting').checked;
      const diffOnly = shadow.getElementById('diff-only-setting').checked;
      setApiKey(key);
      setModel(model);
      setAutoApply(autoApply);
      setYoloAutoSend(yoloAutoSend);
      setShowWelcomeButton(showWelcomeBtn);
      setAllowExternalLibs(allowExternalLibs);
      setDiffOnly(diffOnly);
      settingsModal.style.display = 'none';
      // Re-render chat tab if it's active
      if (currentTab === 'chat') renderTab('chat');
    };

    // Cancel handler
    shadow.getElementById('close-settings').onclick = () => {
      settingsModal.style.display = 'none';
    };

    // ESC key closes modal
    modalDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        settingsModal.style.display = 'none';
      }
    });

    // Clicking outside modal content closes modal
    modalDiv.addEventListener('mousedown', (e) => {
      if (e.target === modalDiv) {
        settingsModal.style.display = 'none';
      }
    });

    // Save State logic
    shadow.getElementById('export-state').onclick = async () => {
      // Gather localStorage (except API key)
      const localKeys = [
        'autoregret_chat_history',
        'autoregret_user_wishes',
        'autoregret_auto_apply',
        'autoregret_yolo_autosend',
        'autoregret_openai_model',
        'autoregret_show_welcome_button',
        'autoregret_allow_external_libs',
        'autoregret_diff_only'
      ];
      const localStorageState = {};
      for (const key of localKeys) {
        const val = localStorage.getItem(key);
        if (val !== null) localStorageState[key] = val;
      }
      // Gather files and history from IndexedDB
      const { listFiles, listHistory } = await import('../core/storage.js');
      const files = await listFiles();
      // Gather all history for all files
      let allHistory = [];
      for (const file of files) {
        const history = await listHistory(file.name);
        allHistory = allHistory.concat(history);
      }
      // Build export object
      const exportObj = {
        version: 1,
        localStorage: localStorageState,
        files,
        history: allHistory
      };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'autoregret-state.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };

    // Load State logic
    const importInput = shadow.getElementById('import-state-file');
    shadow.getElementById('import-state').onclick = () => {
      importInput.value = '';
      importInput.click();
    };
    importInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        alert('Invalid JSON file.');
        return;
      }
      if (!data || typeof data !== 'object' || !data.files || !data.localStorage) {
        alert('Invalid state file format.');
        return;
      }
      // Restore localStorage (except API key)
      for (const [key, val] of Object.entries(data.localStorage)) {
        if (key !== 'autoregret_openai_api_key') {
          localStorage.setItem(key, val);
        }
      }
      // Restore files and history in IndexedDB
      const { initStorage, saveFile } = await import('../core/storage.js');
      await initStorage();
      // Clear all files and history
      const dbReq = indexedDB.open('autoregret-files');
      dbReq.onsuccess = async (event) => {
        const db = event.target.result;
        const tx = db.transaction(['files', 'history'], 'readwrite');
        tx.objectStore('files').clear();
        tx.objectStore('history').clear();
        tx.oncomplete = async () => {
          // Restore files
          for (const file of data.files) {
            await saveFile(file, 'import', 'imported');
          }
          // Restore history
          if (data.history && Array.isArray(data.history)) {
            for (const h of data.history) {
              try {
                const txh = db.transaction('history', 'readwrite');
                txh.objectStore('history').add(h);
              } catch (e) {}
            }
          }
          // Reload app to reflect imported state
          location.reload();
        };
      };
    };
  };
  purgeBtn.onclick = async () => {
    if (!confirm('Purge all app data and restore to original state? This cannot be undone.')) return;
    // Preserve all user settings
    const preservedSettings = {
      apiKey: localStorage.getItem('autoregret_openai_api_key'),
      model: localStorage.getItem('autoregret_openai_model'),
      autoApply: localStorage.getItem('autoregret_auto_apply'),
      yoloAutoSend: localStorage.getItem('autoregret_yolo_autosend'),
      showWelcome: localStorage.getItem('autoregret_show_welcome_button'),
      allowExternalLibs: localStorage.getItem('autoregret_allow_external_libs'),
      diffOnly: localStorage.getItem('autoregret_diff_only')
    };
    // Clear all localStorage
    localStorage.clear();
    // Remove chat and wishes history (redundant after clear, but kept for safety)
    localStorage.removeItem('autoregret_chat_history');
    localStorage.removeItem('autoregret_user_wishes');
    // Restore all settings
    if (preservedSettings.apiKey) localStorage.setItem('autoregret_openai_api_key', preservedSettings.apiKey);
    if (preservedSettings.model) localStorage.setItem('autoregret_openai_model', preservedSettings.model);
    if (preservedSettings.autoApply) localStorage.setItem('autoregret_auto_apply', preservedSettings.autoApply);
    if (preservedSettings.yoloAutoSend) localStorage.setItem('autoregret_yolo_autosend', preservedSettings.yoloAutoSend);
    if (preservedSettings.showWelcome) localStorage.setItem('autoregret_show_welcome_button', preservedSettings.showWelcome);
    if (preservedSettings.allowExternalLibs) localStorage.setItem('autoregret_allow_external_libs', preservedSettings.allowExternalLibs);
    if (preservedSettings.diffOnly) localStorage.setItem('autoregret_diff_only', preservedSettings.diffOnly);
    // Delete ALL IndexedDB databases (not just autoregret-files)
    if (indexedDB.databases) {
      // Modern browsers: enumerate and delete all
      try {
        const dbs = await indexedDB.databases();
        let pending = dbs.length;
        if (pending === 0) location.reload();
        dbs.forEach(db => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = () => {
            pending--;
            if (pending === 0) location.reload();
          };
        });
      } catch (e) {
        // Fallback: just delete autoregret-files
        const req = indexedDB.deleteDatabase('autoregret-files');
        req.onsuccess = req.onerror = req.onblocked = () => {
          location.reload();
        };
      }
    } else {
      // Older browsers: just delete autoregret-files
      const req = indexedDB.deleteDatabase('autoregret-files');
      req.onsuccess = req.onerror = req.onblocked = () => {
        location.reload();
      };
    }
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
      chevron.textContent = '▼';
      // Allow pointer events only on the header title (chevron)
      host.style.pointerEvents = 'none';
      panelHeaderTitle.style.pointerEvents = 'auto';
    } else {
      host.style.height = '700px';
      host.style.width = '400px';
      host.style.borderRadius = '10px 10px 10px 10px';
      panelWrapper.classList.remove('minimized');
      chevron.textContent = '▲';
      // Restore pointer events
      host.style.pointerEvents = '';
      panelHeaderTitle.style.pointerEvents = '';
    }
  };

  // --- Draggable Panel Logic ---
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Use the panel header as the drag handle
  const panelHeader = shadow.querySelector('.panel-header');
  panelHeader.style.cursor = 'move';

  panelHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    // Calculate offset relative to the host's top-left
    const rect = host.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    // Calculate new position
    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;
    // Clamp to viewport
    newLeft = Math.max(0, Math.min(window.innerWidth - host.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - host.offsetHeight, newTop));
    host.style.left = newLeft + 'px';
    host.style.top = newTop + 'px';
    host.style.right = '';
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.6';
    try {
      // Dynamically import listFiles
      const { listFiles } = await import('../core/storage.js');
      const files = await listFiles();
      const modFiles = files.filter(f => f.modifiable);
      // Sort .js files first, then .css, then .json/other
      const jsFiles = modFiles.filter(f => f.name.endsWith('.js'));
      const cssFiles = modFiles.filter(f => f.name.endsWith('.css'));
      const jsonFiles = modFiles.filter(f => f.name.endsWith('.json'));
      const otherFiles = modFiles.filter(f => !f.name.endsWith('.js') && !f.name.endsWith('.css') && !f.name.endsWith('.json'));
      // Build HTML
      let html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>AutoRegret Bundle</title>\n`;
      // Inline CSS
      for (const file of cssFiles) {
        html += `  <style>\n/* File: ${file.name} */\n${file.content}\n</style>\n`;
      }
      // Inline the loader before user JS
      let loaderCode = await fetch('framework/core/libLoader.js').then(r => r.text());
      loaderCode = loaderCode.replace(/export\s+(function|const|let|var|class)\s+/g, '$1 ');
      html += `<script>\n// Inlined libLoader.js\n${loaderCode}\n</script>\n`;
      html += '</head>\n<body>\n  <div id="autoregret-root"></div>\n';
      // Inline JSON as JS variables
      for (const file of jsonFiles) {
        const varName = file.name.replace(/\W+/g, '_').replace(/^_+|_+$/g, '');
        html += `<script>window['${varName}'] = ${file.content};</script>\n`;
      }
      // Inline other files as comments
      for (const file of otherFiles) {
        html += `<!-- File: ${file.name} (not inlined) -->\n`;
      }
      // Inline JS files
      for (const file of jsFiles) {
        // Remove export statements for browser compatibility
        let code = file.content.replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ');
        if (file.name === 'App.js') {
          code = code.replace(/\b(const|let|var)\s+App\s*=/, 'window.App =');
        }
        html += `<script>\n// File: ${file.name}\n${code}\n</script>\n`;
      }
      // Auto-run App.init()
      html += `<script>if (window.App && typeof window.App.init === 'function') window.App.init();</script>\n`;
      html += '</body>\n</html>';
      // Download
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'autoregret-bundle.html';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      alert('Failed to bundle and download: ' + e.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '';
    }
  };

  // TODO: Make panel draggable
} 