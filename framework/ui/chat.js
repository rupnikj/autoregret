import { sendPrompt, getApiKey } from '../core/gpt.js';
import { listFiles, loadFile, saveFile, listHistory, deleteHistoryEntry } from '../core/storage.js';
import { previewDiff } from '../core/diffEngine.js';

// Load chat history and wishes from localStorage if present
let chatHistory = [];
let userWishes = [];
try {
  const savedChat = localStorage.getItem('autoregret_chat_history');
  if (savedChat) chatHistory = JSON.parse(savedChat);
} catch (e) { chatHistory = []; }
try {
  const savedWishes = localStorage.getItem('autoregret_user_wishes');
  if (savedWishes) userWishes = JSON.parse(savedWishes);
} catch (e) { userWishes = []; }

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

// Helper for record/stop icon
function MicIcon({ recording }) {
  if (recording) {
    // Stop icon (red square)
    return `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="16" height="16" rx="4" fill="#b31d28"/></svg>`;
  } else {
    // Record icon (red circle)
    return `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="8" fill="#b31d28"/></svg>`;
  }
}

export function renderChat(container, opts) {
  const autoApply = opts && typeof opts.autoApply !== 'undefined' ? opts.autoApply : true;
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%">
      <div id="chat-apikey-warning" style="display:none; color:#b31d28; background:#fff3cd; border:1px solid #ffeeba; border-radius:4px; padding:8px; margin-bottom:8px; font-size:14px;"></div>
      <div id="chat-messages" style="flex:1; overflow:auto; margin-bottom:8px; background:#f9f9f9; padding:8px; border-radius:6px; min-height:60px;"></div>
      <div style="display:flex; gap:8px; align-items:center;">
        <textarea id="chat-input"
          rows="1"
          style="flex:1; height:48px; box-sizing:border-box; border-radius:8px; padding:12px 14px; font-size:14px; border:1px solid #bbb; resize:none;"
          placeholder="Ask AutoRegret..."></textarea>
        <button id="chat-send"
          style="height:48px; min-width:72px; box-sizing:border-box; border-radius:8px; font-size:14px; border:1px solid #bbb; background:#f7faff; cursor:pointer; transition:background 0.2s;">
          Send
        </button>
      </div>
      <div id="chat-placeholder" style="margin-top:4px; color:#aaa; font-size:13px;">Type or record what you want this website to self-modify.</div>
    </div>
  `;
  const warningDiv = container.querySelector('#chat-apikey-warning');
  const messagesDiv = container.querySelector('#chat-messages');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send');
  const chatPlaceholder = container.querySelector('#chat-placeholder');

  // Show warning if API key is not set
  const apiKey = getApiKey && getApiKey();
  if (!apiKey) {
    warningDiv.innerHTML = '⚠️ <b>OpenAI API key not set.</b> Go to the <b>Settings</b> tab (⚙️) to enter your key.';
    warningDiv.style.display = '';
    input.disabled = true;
    sendBtn.disabled = true;
  } else {
    warningDiv.style.display = 'none';
    input.disabled = false;
    sendBtn.disabled = false;
  }

  // Add mic button to the UI
  const micBtn = document.createElement('button');
  micBtn.id = 'chat-mic';
  micBtn.style.height = '48px';
  micBtn.style.width = '48px';
  micBtn.style.border = 'none';
  micBtn.style.background = 'transparent';
  micBtn.style.cursor = 'pointer';
  micBtn.style.display = 'flex';
  micBtn.style.alignItems = 'center';
  micBtn.style.justifyContent = 'center';
  micBtn.innerHTML = MicIcon({ recording: false });
  sendBtn.parentNode.insertBefore(micBtn, sendBtn);

  // --- Voice recording state ---
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  // --- Mic button handlers ---
  micBtn.onmousedown = startRecording;
  micBtn.onmouseup = stopRecording;
  micBtn.ontouchstart = startRecording;
  micBtn.ontouchend = stopRecording;

  function updateMicIcon() {
    micBtn.innerHTML = MicIcon({ recording: isRecording });
  }

  // --- Voice recording logic ---
  async function startRecording() {
    if (isRecording) return;
    if (!navigator.mediaDevices) {
      chatPlaceholder.textContent = 'Microphone not supported in this browser.';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new window.MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = handleRecordingStop;
      mediaRecorder.start();
      isRecording = true;
      updateMicIcon();
      chatPlaceholder.textContent = 'Recording...';
    } catch (err) {
      chatPlaceholder.textContent = 'Microphone access denied.';
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    mediaRecorder.stop();
    isRecording = false;
    updateMicIcon();
    chatPlaceholder.textContent = 'Transcribing...';
  }

  async function handleRecordingStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    try {
      const apiKey = getApiKey && getApiKey();
      if (!apiKey) {
        chatPlaceholder.textContent = 'OpenAI API key not set.';
        return;
      }
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'gpt-4o-transcribe');
      // You can add language or prompt fields if desired
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });
      const data = await response.json();
      if (data.text) {
        input.value = data.text;
        chatPlaceholder.textContent = 'Voice transcribed!';
        input.focus();
      } else {
        chatPlaceholder.textContent = 'Transcription failed.';
      }
    } catch (err) {
      chatPlaceholder.textContent = 'Error: ' + err.message;
    }
  }

  function renderMessages() {
    messagesDiv.innerHTML = chatHistory.map((msg, idx) => {
      if (msg.role === 'assistant' && msg.fileName && msg.content) {
        // Show file output with prompt history toggle and lucky/revert button
        const isLucky = !!msg.luckyState;
        const showDiff = msg.showChatDiff;
        const promptDetails = msg.promptHistory ? `
          <div class='prompt-history-details' style='display:${msg.showPromptHistory ? 'block' : 'none'}; background:#f4f4f4; border-radius:4px; padding:6px; margin-top:4px;'>
            <b>System Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.systemPrompt)}</pre>
            <b>User Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.userPrompt)}</pre>
            <b>Raw GPT Output:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.gptOutput)}</pre>
          </div>` : '';
        return `<div style="margin-bottom:6px;"><b>GPT (file):</b><pre style='background:#eee; padding:6px; border-radius:4px; overflow:auto;'>${escapeHTML(msg.content)}</pre><div style='display:flex; gap:8px; margin-top:4px;'><button class='chat-lucky' data-idx='${idx}'>${isLucky ? 'Revert' : "Apply"}</button><button class='chat-toggle-diff' data-idx='${idx}'>${showDiff ? 'Hide Diff' : 'Show Diff'}</button>${msg.promptHistory ? `<button class='toggle-prompt-history' data-idx='${idx}'>${msg.showPromptHistory ? 'Hide' : 'Show'} Prompt Details</button>` : ''}</div><pre class='chat-inline-diff' style='margin-top:6px; background:#f9f9f9; padding:8px; border-radius:6px; overflow:auto; max-height:180px; font-family:monospace; font-size:13px; white-space:pre-wrap; border:1px solid #e0e6ef;'>${showDiff ? 'Loading diff...' : ''}</pre>${promptDetails}</div>`;
      }
      if (msg.role === 'assistant' && msg.promptHistory) {
        // Non-file GPT output with prompt history
        const promptDetails = `
          <div style='margin-top:4px;'>
            <button class='toggle-prompt-history' data-idx='${idx}'>${msg.showPromptHistory ? 'Hide' : 'Show'} Prompt Details</button>
            <div class='prompt-history-details' style='display:${msg.showPromptHistory ? 'block' : 'none'}; background:#f4f4f4; border-radius:4px; padding:6px; margin-top:4px;'>
              <b>System Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.systemPrompt)}</pre>
              <b>User Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.userPrompt)}</pre>
              <b>Raw GPT Output:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.gptOutput)}</pre>
            </div>
          </div>`;
        return `<div style="margin-bottom:6px;"><b>GPT:</b> ${escapeHTML(msg.content)}${promptDetails}</div>`;
      }
      return `<div style="margin-bottom:6px;"><b>${msg.role === 'user' ? 'You' : 'GPT'}:</b> ${escapeHTML(msg.content)}</div>`;
    }).join('');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    // Wire up "Apply"/"Revert" buttons
    messagesDiv.querySelectorAll('.chat-lucky').forEach((btn, i) => {
      btn.onclick = async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const msg = chatHistory[idx];
        if (!msg) return;
        if (!msg.luckyState) {
          const fileName = msg.fileName;
          const prevFile = await loadFile(fileName);
          if (!prevFile) {
            chatPlaceholder.textContent = 'File not found.';
            return;
          }
          const prevContent = prevFile.content;
          await saveFile({ ...prevFile, content: msg.content });
          const history = await listHistory(fileName);
          const luckyHistoryId = history.length ? history[0].id : null;
          msg.luckyState = { prevContent, luckyHistoryId };
          if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
          renderMessages();
          chatPlaceholder.textContent = 'Lucky patch applied!';
        } else {
          // Revert: restore previous content and delete lucky version from history
          const { prevContent, luckyHistoryId } = msg.luckyState;
          const fileName = msg.fileName;
          const file = await loadFile(fileName);
          if (!file) {
            chatPlaceholder.textContent = 'File not found.';
            return;
          }
          await saveFile({ ...file, content: prevContent });
          if (luckyHistoryId) await deleteHistoryEntry(luckyHistoryId);
          if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
          delete msg.luckyState;
          renderMessages();
          chatPlaceholder.textContent = 'Reverted!';
        }
      };
    });
    // Wire up Show/Hide Diff buttons
    messagesDiv.querySelectorAll('.chat-toggle-diff').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const msg = chatHistory[idx];
        msg.showChatDiff = !msg.showChatDiff;
        // Only re-render this message's diff area
        const diffDivs = messagesDiv.querySelectorAll('.chat-inline-diff');
        const diffDiv = diffDivs[Array.from(messagesDiv.querySelectorAll('.chat-toggle-diff')).indexOf(btn)];
        if (msg.showChatDiff) {
          if (diffDiv) diffDiv.innerHTML = 'Loading diff...';
          const fileName = msg.fileName;
          const newContent = msg.content;
          const file = await loadFile(fileName);
          const oldContent = file ? file.content : '';
          const diff = await previewDiff(oldContent, newContent, fileName);
          const diffHtml = colorizeDiff(diff);
          if (diffDiv) diffDiv.innerHTML = diffHtml;
        } else {
          if (diffDiv) diffDiv.innerHTML = '';
        }
        // Update the button label
        btn.textContent = msg.showChatDiff ? 'Hide Diff' : 'Show Diff';
      };
    });
    // Wire up prompt history toggles
    messagesDiv.querySelectorAll('.toggle-prompt-history').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        chatHistory[idx].showPromptHistory = !chatHistory[idx].showPromptHistory;
        renderMessages();
      };
    });
  }

  sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    chatHistory.push({ role: 'user', content: text });
    userWishes.push(text);
    // Persist chatHistory and userWishes
    try {
      localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
      localStorage.setItem('autoregret_user_wishes', JSON.stringify(userWishes));
    } catch (e) {}
    renderMessages();
    input.value = '';
    chatPlaceholder.textContent = 'Thinking...';
    try {
      // Gather file context
      const files = await listFiles();
      const modFiles = files.filter(f => f.modifiable);
      const context = modFiles.map(f => `// File: ${f.name}\n${f.content}`).join('\n\n');
      // Add wish history to the prompt
      const wishHistory = userWishes.map((wish, i) => `${i + 1}. ${wish}`).join('\n');
      const systemPrompt = `You are AutoRegret, an AI code assistant for a live-editable JavaScript frontend app.\n\n- The app consists of the following files (see below), each shown as: // File: <name>\n<content>\n- The app is pure client-side, using only vanilla JavaScript (NO frameworks, NO Node.js, NO backend).\n- The app uses a virtual file system; files are loaded and executed via eval() in the browser.\n- The entry point is always App.init().\n- NEVER use ES module syntax (do NOT use 'import' or 'export' statements).\n- Only modify files marked as 'modifiable'.\n- NEVER invent new files, frameworks, or change the app structure.\n- When the user asks for a change, respond ONLY with the full, updated content of the relevant file.\n- Respond in the format:\n// File: <filename>\n<full file content>\n- The VERY FIRST LINE of your response MUST be // File: <filename> (no commentary, no blank lines before).\n- Only ONE file per response.\n- Do NOT return diffs.\n- The file should be minimal, clean, and correct.\n- If the user request is ambiguous, ask for clarification.\n- Never change files that are not marked as modifiable.\n- Do NOT include explanations, commentary, or extra text—ONLY the file content.\n- IMPORTANT: If you add any persistent state (such as setInterval, setTimeout, or event listeners), you MUST also add an App.cleanup() function that clears all such state. When code is updated, App.cleanup() will be called before reloading. Always ensure that intervals, timeouts, and event listeners are properly removed in App.cleanup().\n- You are also given a list of user wishes (requests) in order. When the user asks to undo or modify a previous wish, use this history to determine the correct action.`;
      const userPrompt = `User wishes so far:\n${wishHistory}\n\nHere are all modifiable files in the app:\n\n${context}\n\nUser request: ${text}\n\nINSTRUCTIONS: Respond ONLY with the full, updated content of the relevant file. Do not include explanations or commentary. Respond in the format:\n// File: <filename>\n<full file content>\nThe very first line of your response MUST be // File: <filename>. Only one file per response.`;
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      const response = await sendPrompt('', messages);
      // Try to extract file name and content from response (robust to whitespace)
      const match = response.match(/^\s*\/\/\s*File:\s*([\w.\-\/]+)\s*\n([\s\S]*)$/m);
      const promptHistory = { systemPrompt, userPrompt, gptOutput: response };
      if (match) {
        const fileName = match[1].trim();
        const fileContent = match[2];
        const msgObj = { role: 'assistant', content: fileContent, fileName, promptHistory };
        chatHistory.push(msgObj);
        // Persist chatHistory
        try {
          localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
        } catch (e) {}
        // Auto-apply if enabled
        if (autoApply) {
          setTimeout(async () => {
            // Only auto-apply if not already lucky
            if (!msgObj.luckyState) {
              const prevFile = await loadFile(fileName);
              if (prevFile) {
                const prevContent = prevFile.content;
                await saveFile({ ...prevFile, content: fileContent });
                const history = await listHistory(fileName);
                const luckyHistoryId = history.length ? history[0].id : null;
                msgObj.luckyState = { prevContent, luckyHistoryId };
                if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
                renderMessages();
                chatPlaceholder.textContent = 'Lucky patch auto-applied!';
              }
            }
          }, 0);
        }
      } else {
        chatHistory.push({ role: 'assistant', content: response, promptHistory });
        // Persist chatHistory
        try {
          localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
        } catch (e) {}
      }
      renderMessages();
      chatPlaceholder.textContent = 'Type or record what you want this website to self-modify.';
    } catch (e) {
      chatPlaceholder.textContent = 'Error: ' + e.message;
      if (/401|unauthorized|invalid api key|invalid authentication/i.test(e.message)) {
        chatPlaceholder.style.color = '#b31d28'; // red
      } else {
        chatPlaceholder.style.color = '#888'; // default
      }
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  renderMessages();
}

// Pretty diff colorizer (copied from diff.js)
function colorizeDiff(diffText) {
  return diffText.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<div style='background:#e6ffed;color:#22863a;'>${escapeHTML(line)}</div>`;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<div style='background:#ffeef0;color:#b31d28;'>${escapeHTML(line)}</div>`;
    } else if (line.startsWith('@@')) {
      return `<div style='background:#f1f8ff;color:#0366d6;font-weight:bold;'>${escapeHTML(line)}</div>`;
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      return `<div style='background:#f6f8fa;color:#6a737d;'>${escapeHTML(line)}</div>`;
    } else {
      return `<div style='color:#24292e;'>${escapeHTML(line)}</div>`;
    }
  }).join('');
} 