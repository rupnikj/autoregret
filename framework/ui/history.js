import { loadFile, listFiles, listHistory, restoreHistory } from '../core/storage.js';

// History Tab (placeholder)
export async function renderHistory(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="margin-bottom:8px">
        <label for="history-file-picker">File: </label>
        <select id="history-file-picker"></select>
      </div>
      <div id="history-list" style="flex:1 1 0; min-height:0; max-height:500px; overflow:auto; border:1px solid #eee; border-radius:6px; background:#fafbfc; padding:8px;"></div>
      <div id="history-status" style="margin-top:8px; color:#888; font-size:12px;"></div>
    </div>
  `;
  const filePicker = container.querySelector('#history-file-picker');
  const historyList = container.querySelector('#history-list');
  const status = container.querySelector('#history-status');

  // Populate file picker
  const files = await listFiles();
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    filePicker.appendChild(opt);
  });

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
    if (current) {
      html += `
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:6px; position:relative; background:#f6fbff;">
          <div><b>Current Version</b> <span style='background:#007aff;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;margin-left:8px;'>Current</span> <b>Saved:</b> ${current.lastModified ? new Date(current.lastModified).toLocaleString() : ''}</div>
          <pre style="background:#f4f4f4; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(current.content)}</pre>
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
        }
        return `
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:6px; position:relative;">
          <div><b>Version:</b> ${h.id} <b>Saved:</b> ${new Date(h.timestamp).toLocaleString()}${actionLabel ? ' <b>Action:</b> ' + actionLabel : ''}</div>
          <pre style="background:#f4f4f4; padding:6px; border-radius:4px; overflow:auto;">${escapeHTML(h.content)}</pre>
          <button data-id="${h.id}" class="history-restore">Restore this version</button>
        </div>
      `;
      }).join('');
    }
    historyList.innerHTML = html;
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