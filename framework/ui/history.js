import { loadFile, listFiles, listHistory, restoreHistory } from '../core/storage.js';

// History Tab (placeholder)
let allCollapsed = false;
let entryCollapsed = {};
export async function renderHistory(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; position:relative;">
      <button id="collapse-all-history-btn" title="Collapse all entries" style="position:absolute; top:8px; right:12px; z-index:10; background:rgba(255,255,255,0.95); border:1px solid #bbb; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:pointer; font-size:18px;">
        ${allCollapsed ? '&#9660;' : '&#9650;'}
      </button>
      <div style="margin-bottom:8px">
        <label for="history-file-picker">File: </label>
        <select id="history-file-picker"></select>
      </div>
      <div id="history-list" style="flex:1 1 0; min-height:0; max-height:none; overflow:auto; border:1px solid #eee; border-radius:6px; background:#fafbfc; padding:8px;"></div>
      <div id="history-status-bar" style="margin-top:8px; color:#888; font-size:12px;"></div>
    </div>
  `;
  const filePicker = container.querySelector('#history-file-picker');
  const historyList = container.querySelector('#history-list');
  const status = container.querySelector('#history-status-bar');
  const collapseAllBtn = container.querySelector('#collapse-all-history-btn');

  // Populate file picker
  const files = await listFiles();
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    filePicker.appendChild(opt);
  });

  if (collapseAllBtn) {
    collapseAllBtn.onclick = () => {
      allCollapsed = !allCollapsed;
      Object.keys(entryCollapsed).forEach(id => { entryCollapsed[id] = allCollapsed; });
      entryCollapsed['current'] = allCollapsed;
      // Update icon and tooltip
      collapseAllBtn.innerHTML = allCollapsed ? '&#9660;' : '&#9650;';
      collapseAllBtn.title = allCollapsed ? 'Expand all entries' : 'Collapse all entries';
      if (filePicker.value) showHistory(filePicker.value);
    };
  }

  async function showHistory(fileName) {
    historyList.innerHTML = 'Loading...';
    // Get current version
    const current = await loadFile(fileName);
    const history = await listHistory(fileName);
    if (!current && !history.length) {
      historyList.innerHTML = '<em>No history for this file.</em>';
      return;
    }
    let html = '';
    // Collapse state for current version
    if (typeof entryCollapsed['current'] === 'undefined') entryCollapsed['current'] = allCollapsed;
    const isCurrentCollapsed = entryCollapsed['current'];
    if (current) {
      html += `
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:6px; position:relative; background:#f6fbff;">
          <div><b>Current Version</b> <span style='background:#007aff;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;margin-left:8px;'>Current</span> <b>Saved:</b> ${current.lastModified ? new Date(current.lastModified).toLocaleString() : ''}</div>
          <div style='display:flex; gap:8px; margin-top:4px;'>
            <button class="collapse-toggle-history" data-id="current">${isCurrentCollapsed ? 'Show' : 'Hide'}</button>
          </div>
          <div class="history-content" style="${isCurrentCollapsed ? 'display:none;' : ''}"><pre style="background:#f4f4f4; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(current.content)}</pre></div>
        </div>
      `;
    }
    if (history.length) {
      html += history.map((h, idx) => {
        let actionLabel = '';
        if (h.action === 'wish' && h.wish) {
          actionLabel = `<span style='color:#007aff;'>Wish:</span> ${escapeHTML(h.wish)}`;
        } else if (h.action === 'restore' && h.wish) {
          actionLabel = `<span style='color:#b31d28;'>Restored version</span> ${h.wish}`;
        } else if (h.action === 'manual') {
          actionLabel = `<span style='color:#a259e6;'>Manual edit</span>`;
        }
        if (typeof entryCollapsed[h.id] === 'undefined') entryCollapsed[h.id] = allCollapsed;
        const isCollapsed = entryCollapsed[h.id];
        return `
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:6px; position:relative;">
          <div><b>Version:</b> ${h.id} <b>Saved:</b> ${new Date(h.timestamp).toLocaleString()}${actionLabel ? ' <b>Action:</b> ' + actionLabel : ''}</div>
          <div style='display:flex; gap:8px; margin-top:4px;'>
            <button class="collapse-toggle-history" data-id="${h.id}">${isCollapsed ? 'Show' : 'Hide'}</button>
            <button data-id="${h.id}" class="history-restore">Restore this version</button>
          </div>
          <div class="history-content" style="${isCollapsed ? 'display:none;' : ''}"><pre style="background:#f4f4f4; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(h.content)}</pre></div>
        </div>
      `;
      }).join('');
    }
    historyList.innerHTML = html;
    // Per-entry collapse toggles
    historyList.querySelectorAll('.collapse-toggle-history').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        entryCollapsed[id] = !entryCollapsed[id];
        showHistory(fileName);
      };
    });
    // Wire up restore buttons
    historyList.querySelectorAll('.history-restore').forEach(btn => {
      btn.onclick = async () => {
        status.textContent = 'Restoring...';
        await restoreHistory(fileName, Number(btn.getAttribute('data-id')));
        status.textContent = 'Restored!';
        setTimeout(() => { status.textContent = ''; }, 1200);
        // Refresh history to show new current version
        showHistory(fileName);
        if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
      };
    });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  filePicker.onchange = () => {
    showHistory(filePicker.value);
  };

  // Show history for the first file by default
  if (files.length) showHistory(files[0].name);
} 