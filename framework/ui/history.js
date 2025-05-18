import { listAppHistory, restoreAppHistory } from '../core/storage.js';

// History Tab (placeholder)
let allCollapsed = false;
let entryCollapsed = {};
export async function renderHistory(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; position:relative;">
      <button id="collapse-all-history-btn" title="Collapse all entries" style="position:absolute; top:8px; right:12px; z-index:10; background:rgba(255,255,255,0.95); border:1px solid #bbb; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:pointer; font-size:18px;">
        ${allCollapsed ? '&#9660;' : '&#9650;'}
      </button>
      <div id="history-list" style="flex:1 1 0; min-height:0; max-height:none; overflow:auto; border:1px solid #eee; border-radius:6px; background:#fafbfc; padding:8px;"></div>
      <div id="history-status-bar" style="margin-top:8px; color:#888; font-size:12px;"></div>
    </div>
  `;
  const historyList = container.querySelector('#history-list');
  const status = container.querySelector('#history-status-bar');
  const collapseAllBtn = container.querySelector('#collapse-all-history-btn');

  if (collapseAllBtn) {
    collapseAllBtn.onclick = () => {
      allCollapsed = !allCollapsed;
      Object.keys(entryCollapsed).forEach(id => { entryCollapsed[id] = allCollapsed; });
      // Update icon and tooltip
      collapseAllBtn.innerHTML = allCollapsed ? '&#9660;' : '&#9650;';
      collapseAllBtn.title = allCollapsed ? 'Expand all entries' : 'Collapse all entries';
      showHistory();
    };
  }

  async function showHistory() {
    historyList.innerHTML = 'Loading...';
    const appHistory = await listAppHistory();
    if (!appHistory.length) {
      historyList.innerHTML = '<em>No history for this app.</em>';
      return;
    }
    let html = '';
    html += appHistory.map((entry, idx) => {
      if (typeof entryCollapsed[entry.id] === 'undefined') entryCollapsed[entry.id] = allCollapsed;
      const isCollapsed = entryCollapsed[entry.id];
      let actionLabel = '';
      if (entry.action === 'wish') {
        actionLabel = `<span style='color:#007aff;'>Wish</span>`;
      } else if (entry.action === 'restore') {
        actionLabel = `<span style='color:#b31d28;'>Restored version</span>`;
      } else if (entry.action === 'manual') {
        actionLabel = `<span style='color:#a259e6;'>Manual edit</span>`;
      } else if (entry.action === 'initial') {
        actionLabel = `<span style='color:#888;'>Initial</span>`;
      }
      // Show all files in this snapshot
      const filesHtml = entry.files.map(f => `
        <div style='margin-bottom:8px;'>
          <b>${escapeHTML(f.name)}</b>
          <pre style="background:#f4f4f4; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(f.content)}</pre>
        </div>
      `).join('');
      // Show chat history
      const chatHtml = entry.chatHistory && entry.chatHistory.length ? `
        <div style='margin-bottom:8px;'>
          <b>Chat History:</b>
          <pre style="background:#f9f9f9; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(JSON.stringify(entry.chatHistory, null, 2))}</pre>
        </div>
      ` : '';
      // Show wishes
      const wishesHtml = entry.userWishes && entry.userWishes.length ? `
        <div style='margin-bottom:8px;'>
          <b>User Wishes:</b>
          <pre style="background:#f9f9f9; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(JSON.stringify(entry.userWishes, null, 2))}</pre>
        </div>
      ` : '';
      return `
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:6px; position:relative;">
          <div><b>Version:</b> ${appHistory.length - idx - 1} <b>Saved:</b> ${new Date(entry.timestamp).toLocaleString()}${actionLabel ? ' <b>Action:</b> ' + actionLabel : ''}</div>
          <div style='display:flex; gap:8px; margin-top:4px;'>
            <button class="collapse-toggle-history" data-id="${entry.id}">${isCollapsed ? 'Show' : 'Hide'}</button>
            <button data-id="${entry.id}" class="history-restore">Restore this version</button>
          </div>
          <div class="history-content" style="${isCollapsed ? 'display:none;' : ''}">
            ${filesHtml}
            ${chatHtml}
            ${wishesHtml}
          </div>
        </div>
      `;
    }).join('');
    historyList.innerHTML = html;
    // Per-entry collapse toggles
    historyList.querySelectorAll('.collapse-toggle-history').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        entryCollapsed[id] = !entryCollapsed[id];
        showHistory();
      };
    });
    // Wire up restore buttons
    historyList.querySelectorAll('.history-restore').forEach(btn => {
      btn.onclick = async () => {
        status.textContent = 'Restoring...';
        await restoreAppHistory(Number(btn.getAttribute('data-id')));
        status.textContent = 'Restored!';
        setTimeout(() => { status.textContent = ''; }, 1200);
        // Refresh history to show new current version
        showHistory();
        if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
      };
    });
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Show app history on load
  showHistory();
} 