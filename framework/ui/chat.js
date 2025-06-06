import { sendPrompt, getApiKey } from '../core/gpt.js';
import { listFiles, loadFile, saveFile } from '../core/storage.js';
import { previewDiff } from '../core/diffEngine.js';
import { applyV4APatch, V4APatchError } from '../core/v4aPatch.js';

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

let allCollapsed = false;

// --- Add pending state for manual apply mode ---
let pendingUserMsg = null;
let pendingAssistantMsg = null;

// --- Helper to build system prompt ---
function buildSystemPrompt({ diffOnly, allowExternalLibs }) {
  const systemMsgCommon = `You are AutoRegret, an AI code assistant for a live-editable JavaScript frontend app.\n\n- The app consists of the following files (see below), each shown as: // File: <name>\n<content>\n- The app is pure client-side, using only vanilla JavaScript (NO frameworks, NO Node.js, NO backend).\n- The app uses a virtual file system; files are loaded and executed via eval() in the browser.\n- The entry point is always App.init().\n- NEVER use ES module syntax (do NOT use 'import' or 'export' statements).\n- Only modify files marked as 'modifiable'.\n- NEVER invent new files, frameworks, or change the app structure.\n- If you add any persistent state (such as setInterval, setTimeout, or event listeners), you MUST also add an App.cleanup() function that clears all such state. When code is updated, App.cleanup() will be called before reloading. Always ensure that intervals, timeouts, and event listeners are properly removed in App.cleanup().\n- You are also given a list of user wishes (requests) in order. When the user asks to undo or modify a previous wish, use this history to determine the correct action.`;
  const systemMsgDiff = `- When the user asks for a change, respond ONLY with a V4A patch in the following format:\n*** Begin Patch\n*** Update File: <filename>\n@@ <context>\n-<old line>\n+<new line>\n*** End Patch\n- The patch must be valid and minimal. Do not include explanations, commentary, or extra text—ONLY the patch.\n- Only ONE file per patch.\n- Never change files that are not marked as modifiable.\n- IMPORTANT: Always include at least 2 lines of unchanged context before and after your changes (if possible), using the unified diff format. This ensures the patch can be applied robustly even if the file changes.`;
  const systemMsgFullFile = `- When the user asks for a change, respond ONLY with the full, updated content of the relevant file.\n- Respond in the format:\n// File: <filename>\n<full file content>\n- The VERY FIRST LINE of your response MUST be // File: <filename> (no commentary, no blank lines before).\n- Only ONE file per response.\n- Do NOT return diffs.\n- The file should be minimal, clean, and correct.\n- Never change files that are not marked as modifiable.\n- Do NOT include explanations, commentary, or extra text—ONLY the file content.`;
  const systemMsgNoExtLibs = `- IMPORTANT: You MUST NOT use any external JavaScript libraries, CDN scripts, or load any code from the internet. Only use code that is already present in the app files. Do NOT add script tags or reference any external URLs.`;
  const systemMsgExtLibs = `- If a user wish requires a new JavaScript library, you MUST use the global function loadExternalLibrary (do NOT use import or require). Example usage:\n\nloadExternalLibrary({\n  globalVar: 'pdfjsLib',\n  url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js',\n  onload: () => {\n    // Use window.pdfjsLib here\n  }\n});\nAlways check for the global variable before using the library. Do NOT hardcode library URLs or add script tags manually. NEVER use import or export statements in user code.\n\n- When using loadExternalLibrary, always provide the full cdnjs/jsDelivr file URL (case-sensitive, e.g., https://cdnjs.cloudflare.com/ajax/libs/tone/15.1.5/Tone.js). Only use cdnjs or jsDelivr for external libraries and prefer universal module definition builds.`;
  let systemPrompt = systemMsgCommon + '\n\n';
  if (diffOnly) {
    systemPrompt += systemMsgDiff + '\n\n';
  } else {
    systemPrompt += systemMsgFullFile + '\n\n';
  }
  if (allowExternalLibs) {
    systemPrompt += systemMsgExtLibs;
  } else {
    systemPrompt += systemMsgNoExtLibs;
  }
  return systemPrompt;
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function getYoloAutoSend() {
  const val = localStorage.getItem('autoregret_yolo_autosend');
  return val === null ? false : val === 'true';
}

function getDiffOnly() {
  const val = localStorage.getItem('autoregret_diff_only');
  return val === 'true';
}

// Helper: detect if a string is a V4A patch
function isV4APatch(text) {
  const result = /^\*\*\* Begin Patch/m.test(text) && /\*\*\* End Patch/m.test(text);
  if (result) console.log('[AutoRegret] Detected V4A patch in response');
  return result;
}

// Helper: apply a V4A patch to the virtual FS
async function applyPatchToFS(patchText) {
  console.log('[AutoRegret] Attempting to apply V4A patch:', patchText);
  const filesArr = await listFiles();
  const files = {};
  for (const f of filesArr) files[f.name] = f.content;
  let result;
  try {
    result = applyV4APatch(patchText, files);
    // console.log('[AutoRegret] Patch application result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('[AutoRegret] Patch application error:', e);
    throw new V4APatchError(e.message);
  }
  // Get the latest user wish
  const latestWish = userWishes[userWishes.length - 1] || 'V4A patch update';
  // Apply updates
  for (const [name, content] of Object.entries(result.updatedFiles)) {
    console.log(`[AutoRegret] Updating file: ${name}`);
    const fileObj = filesArr.find(f => f.name === name);
    if (fileObj) await saveFile({ ...fileObj, content }, 'wish', latestWish);
  }
  // Add new files
  for (const [name, content] of Object.entries(result.addedFiles)) {
    console.log(`[AutoRegret] Adding file: ${name}`);
    await saveFile({ name, content, modifiable: true, framework: 'vanilla', lastModified: Date.now() }, 'wish', latestWish);
  }
  // Delete files
  for (const name of result.deletedFiles) {
    console.log(`[AutoRegret] Deleting file: ${name}`);
    const fileObj = filesArr.find(f => f.name === name);
    if (fileObj) await saveFile({ ...fileObj, content: '', modifiable: false }, 'wish', latestWish);
  }
  if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
}

export function renderChat(container, opts) {
  // Always reload chat state from localStorage when rendering chat tab
  try {
    const savedChat = localStorage.getItem('autoregret_chat_history');
    chatHistory = savedChat ? JSON.parse(savedChat) : [];
  } catch (e) { chatHistory = []; }
  try {
    const savedWishes = localStorage.getItem('autoregret_user_wishes');
    userWishes = savedWishes ? JSON.parse(savedWishes) : [];
  } catch (e) { userWishes = []; }
  pendingUserMsg = null;
  pendingAssistantMsg = null;
  const autoApply = opts && typeof opts.autoApply !== 'undefined' ? opts.autoApply : true;
  function getCollapseIconAndTitle() {
    return allCollapsed
      ? { icon: '&#9660;', title: 'Expand all code responses' } // ▼
      : { icon: '&#9650;', title: 'Collapse all code responses' }; // ▲
  }
  const { icon, title } = getCollapseIconAndTitle();
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; position:relative;">
      <button id="collapse-all-btn" title="${title}" style="position:absolute; top:8px; right:12px; z-index:10; background:rgba(255,255,255,0.95); border:1px solid #bbb; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:pointer; font-size:18px;">
        ${icon}
      </button>
      <div id="chat-apikey-warning" style="display:none; color:#b31d28; background:#fff3cd; border:1px solid #ffeeba; border-radius:4px; padding:8px; margin-bottom:8px; font-size:14px;"></div>
      <div id="chat-messages" style="flex:1; overflow:auto; margin-bottom:8px; background:#f9f9f9; padding:8px; border-radius:6px; min-height:60px;"></div>
      <div id="chat-input-bar" style="display:flex; gap:8px; align-items:center;">
        <textarea id="chat-input"
          rows="1"
          style="flex:1; height:60px; box-sizing:border-box; border-radius:8px; padding:12px 14px; font-size:14px; border:1px solid #bbb; resize:none;"
          placeholder="Ask AutoRegret..."></textarea>
        <button id="chat-send"
          style="height:48px; min-width:40px; box-sizing:border-box; border-radius:8px; font-size:28px; border:none; background:#f7faff; cursor:pointer; transition:background 0.2s;">
          🚀
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

  // --- Restore chat input draft if present ---
  const draftKey = 'autoregret_chat_input_draft';
  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft) input.value = savedDraft;

  // Save draft on input
  input.addEventListener('input', () => {
    localStorage.setItem(draftKey, input.value);
  });

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

  // --- Voice recording state ---
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let pendingSendAfterRecording = false;

  // Add mic button to the UI
  const micBtn = document.createElement('button');
  micBtn.id = 'chat-mic';
  micBtn.style.height = '60px';
  micBtn.style.width = '40px';
  micBtn.style.border = 'none';
  micBtn.style.background = 'transparent';
  micBtn.style.fontSize = '28px';
  micBtn.style.cursor = 'pointer';
  micBtn.style.display = 'flex';
  micBtn.style.alignItems = 'center';
  micBtn.style.justifyContent = 'center';
  micBtn.textContent = isRecording ? '🟥' : '🔴';
  sendBtn.parentNode.insertBefore(micBtn, sendBtn);

  // Add pulsing effect CSS for send button (in shadow DOM)
  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = `
    .autoregret-send-pulse {
      animation: autoregret-send-pulse-fade 1s infinite cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes autoregret-send-pulse-fade {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }
  `;
  container.appendChild(pulseStyle);

  // Add Plan button to the UI
  const planBtn = document.createElement('button');
  planBtn.id = 'chat-plan';
  planBtn.textContent = '📚';
  planBtn.style.height = '48px';
  planBtn.style.minWidth = '40px';
  planBtn.style.borderRadius = '8px';
  planBtn.style.fontSize = '28px';
  planBtn.style.border = 'none';
  planBtn.style.background = 'transparent';
  planBtn.style.cursor = 'pointer';
  sendBtn.parentNode.insertBefore(planBtn, sendBtn);

  // Add Code Reasoning button to the UI
  const reasoningBtn = document.createElement('button');
  reasoningBtn.id = 'chat-reasoning';
  reasoningBtn.textContent = '💡';
  reasoningBtn.title = 'Get code reasoning and suggestions';
  reasoningBtn.style.height = '48px';
  reasoningBtn.style.minWidth = '40px';
  reasoningBtn.style.borderRadius = '8px';
  reasoningBtn.style.fontSize = '28px';
  reasoningBtn.style.border = 'none';
  reasoningBtn.style.background = 'transparent';
  reasoningBtn.style.cursor = 'pointer';
  sendBtn.parentNode.insertBefore(reasoningBtn, sendBtn);

  // --- Mic button handler (toggle) ---
  micBtn.onclick = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  };

  function updateMicIcon() {
    micBtn.textContent = isRecording ? '🟥' : '🔴';
    // Pulse the send button if pendingSendAfterRecording
    if (pendingSendAfterRecording) {
      sendBtn.classList.add('autoregret-send-pulse');
    } else {
      sendBtn.classList.remove('autoregret-send-pulse');
    }
  }

  // --- Scroll input into view on blur (mobile keyboard hide) ---
  input.addEventListener('blur', () => {
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  });

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
        // YOLO: Only auto-send if enabled in settings
        if (getYoloAutoSend()) {
          sendBtn.click();
        }
        // Manual mode: if user clicked send while recording, autosend after transcription
        else if (pendingSendAfterRecording) {
          pendingSendAfterRecording = false;
          sendBtn.classList.remove('autoregret-send-pulse');
          sendBtn.click();
        }
      } else {
        chatPlaceholder.textContent = 'Transcription failed.';
        sendBtn.classList.remove('autoregret-send-pulse');
      }
    } catch (err) {
      chatPlaceholder.textContent = 'Error: ' + err.message;
      sendBtn.classList.remove('autoregret-send-pulse');
    }
  }

  // Plan button handler
  planBtn.onclick = async () => {
    planBtn.disabled = true;
    chatPlaceholder.textContent = 'Searching for external libraries...';
    try {
      // Gather context
      const files = await listFiles();
      const modFiles = files.filter(f => f.modifiable);
      const code = modFiles.map(f => `// File: ${f.name}\n${f.content}`).join('\n\n');
      const wishHistory = userWishes;
      const currentWish = input.value.trim();
      // Blacklist: store in localStorage or use empty for now
      let blacklist = [];
      try {
        const bl = localStorage.getItem('autoregret_lib_blacklist');
        if (bl) blacklist = JSON.parse(bl);
      } catch (e) {}
      // Verified cache: store in localStorage
      let verified = [];
      try {
        const v = localStorage.getItem('autoregret_lib_verified');
        if (v) verified = JSON.parse(v);
      } catch (e) {}
      // Dynamically import the assistant
      const { runLibrarySearchAssistant } = await import('./libSearchAssistant.js');
      const { candidates, rawResponse } = await runLibrarySearchAssistant({ code, wishHistory, currentWish, blacklist });
      // Verification step: test each candidate
      const { testLoadLibrary } = await import('../core/libDiscover.js');
      let valid = [], failed = [];
      for (const url of candidates) {
        const already = verified.find(v => v.url === url);
        if (already) {
          valid.push(url);
          continue;
        }
        try {
          const result = await testLoadLibrary({ url });
          if (result.success && !blacklist.includes(url)) {
            valid.push(url);
            verified.push({ url, detectedGlobal: result.detectedGlobal });
          } else {
            failed.push(url);
          }
        } catch (e) {
          failed.push(url);
        }
      }
      // Save updated verified list
      localStorage.setItem('autoregret_lib_verified', JSON.stringify(verified));
      // Update blacklist if any failed
      if (failed.length > 0) {
        const newBlacklist = Array.from(new Set([...blacklist, ...failed]));
        localStorage.setItem('autoregret_lib_blacklist', JSON.stringify(newBlacklist));
      }
      // Show feedback to user
      if (candidates.length === 0) {
        chatPlaceholder.innerHTML = 'No external libraries needed.';
        // Remove any previous plan block from input
        const planBlockRegex = /\n📚[\s\S]*$/m;
        if (planBlockRegex.test(input.value)) {
          input.value = input.value.replace(planBlockRegex, '');
        }
      } else {
        let html = '';
        if (valid.length > 0) {
          html += '<span style="color:green;">Valid libraries:</span><br>' + valid.map(u => `<span style='color:green;'>${u}</span>`).join('<br>') + '<br>';
        }
        if (failed.length > 0) {
          html += '<span style="color:#b31d28;">Failed libraries (blacklisted, will retry if you click search libraries again):</span><br>' + failed.map(u => `<span style='color:#b31d28;'>${u}</span>`).join('<br>') + '<br>';
        }
        chatPlaceholder.innerHTML = html;
        // --- Inject/replace plan block in chat input ---
        const planBlockRegex = /\n📚[\s\S]*$/m;
        let planBlock = '\n📚 You may only use the following libraries:';
        for (const url of valid) {
          planBlock += `\n- ${url}`;
        }
        if (planBlockRegex.test(input.value)) {
          input.value = input.value.replace(planBlockRegex, planBlock);
        } else {
          input.value = input.value + planBlock;
        }
      }
      // Optionally, store the candidates for use in the main chat loop
      window.autoregretLibPlan = { candidates, valid, failed, rawResponse };
    } catch (e) {
      chatPlaceholder.textContent = 'Plan error: ' + e.message;
    }
    planBtn.disabled = false;
  };

  // Code Reasoning button handler
  let reasoningActive = false;
  let lastReasoningBlock = '';
  reasoningBtn.onclick = async () => {
    if (reasoningActive) {
      // Remove reasoning block from chat input
      const planBlockRegex = /\n💡[\s\S]*$/m;
      if (planBlockRegex.test(input.value)) {
        input.value = input.value.replace(planBlockRegex, '');
      }
      reasoningBtn.textContent = '💡';
      reasoningBtn.title = 'Get code reasoning and suggestions';
      reasoningActive = false;
      lastReasoningBlock = '';
      return;
    }
    reasoningBtn.disabled = true;
    chatPlaceholder.textContent = 'Reasoning about your wish...';
    try {
      // Gather context
      const files = await listFiles();
      const modFiles = files.filter(f => f.modifiable);
      const code = modFiles.map(f => `// File: ${f.name}\n${f.content}`).join('\n\n');
      const wishHistory = userWishes;
      const currentWish = input.value.trim();
      // Dynamically import the assistant
      const { runCodeReasoningAssistant } = await import('./codeReasoningAssistant.js');
      const { reasoning, rawResponse } = await runCodeReasoningAssistant({ code, wishHistory, currentWish });
      // Show feedback to user as a chat message
      if (reasoning) {
        chatHistory.push({ role: 'reasoning', content: reasoning, timestamp: Date.now() });
        try { localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory)); } catch (e) {}
        renderMessages();
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        // --- Append reasoning to chat input ---
        const planBlockRegex = /\n💡[\s\S]*$/m;
        let reasoningBlock = `\n💡 ${reasoning}`;
        lastReasoningBlock = reasoningBlock;
        if (planBlockRegex.test(input.value)) {
          input.value = input.value.replace(planBlockRegex, reasoningBlock);
        } else {
          input.value = input.value + reasoningBlock;
        }
        reasoningBtn.textContent = '✖️';
        reasoningBtn.title = 'Remove reasoning from chat input';
        reasoningActive = true;
      } else {
        chatPlaceholder.textContent = 'No reasoning returned.';
      }
      window.autoregretReasoning = { reasoning, rawResponse };
    } catch (e) {
      chatPlaceholder.textContent = 'Reasoning error: ' + e.message;
    }
    reasoningBtn.disabled = false;
  };

  function renderMessages() {
    // console.log('[AutoRegret] Rendering chat messages. chatHistory:', JSON.stringify(chatHistory, null, 2));
    let html = '';
    html += chatHistory.map((msg, idx) => {
      if (msg.role === 'assistant' && msg.fileName && msg.content) {
        if (isV4APatch(msg.content)) {
          // PATCH MODE: Show patch in code block, no Show/Hide Diff button
          const isCollapsed = msg.collapsed;
          const promptDetails = msg.promptHistory ? `
            <div class='prompt-history-details' style='display:${msg.showPromptHistory ? 'block' : 'none'}; background:#f4f4f4; border-radius:4px; padding:6px; margin-top:4px;'>
              <b>System Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.systemPrompt)}</pre>
              <b>User Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.userPrompt)}</pre>
              <b>Raw GPT Output:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.gptOutput)}</pre>
            </div>` : '';
          return `<div style="margin-bottom:6px;">
            <b>GPT (patch${msg.fileName && msg.fileName !== '[patch]' ? `: ${escapeHTML(msg.fileName)}` : ''}):</b>
            <div class="code-block" style="${isCollapsed ? 'display:none;' : ''}"><pre style='background:#eee; padding:6px; border-radius:4px; overflow:auto;'>${escapeHTML(msg.content)}</pre></div>
            <div style='display:flex; gap:8px; margin-top:4px;'>
              <button class="collapse-toggle" data-idx="${idx}">${isCollapsed ? 'Show' : 'Hide'}</button>
              ${msg.promptHistory ? `<button class='toggle-prompt-history' data-idx='${idx}'>${msg.showPromptHistory ? 'Hide' : 'Show'} Prompt Details</button>` : ''}
            </div>
            ${promptDetails}
          </div>`;
        } else {
          // FILE MODE: Show file, Show/Hide Diff button
          if (typeof msg.collapsed === 'undefined') msg.collapsed = allCollapsed;
          const isCollapsed = msg.collapsed;
          const promptDetails = msg.promptHistory ? `
            <div class='prompt-history-details' style='display:${msg.showPromptHistory ? 'block' : 'none'}; background:#f4f4f4; border-radius:4px; padding:6px; margin-top:4px;'>
              <b>System Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.systemPrompt)}</pre>
              <b>User Prompt:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.userPrompt)}</pre>
              <b>Raw GPT Output:</b><pre style='white-space:pre-wrap;'>${escapeHTML(msg.promptHistory.gptOutput)}</pre>
            </div>` : '';
          return `<div style="margin-bottom:6px;">
            <b>GPT (file${msg.fileName ? `: ${escapeHTML(msg.fileName)}` : ''}):</b>
            <div class="code-block" style="${isCollapsed ? 'display:none;' : ''}"><pre style='background:#eee; padding:6px; border-radius:4px; overflow:auto;'>${escapeHTML(msg.content)}</pre></div>
            <div style='display:flex; gap:8px; margin-top:4px;'>
              <button class="collapse-toggle" data-idx="${idx}">${isCollapsed ? 'Show' : 'Hide'}</button>
              ${msg.promptHistory ? `<button class='toggle-prompt-history' data-idx='${idx}'>${msg.showPromptHistory ? 'Hide' : 'Show'} Prompt Details</button>` : ''}
            </div>
            ${promptDetails}
          </div>`;
        }
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
      if (msg.role === 'reasoning') {
        // Render code reasoning as a special block
        return `<div style="margin-bottom:8px;"><b>Reasoning:</b><div style='background:#f7faff; color:#222; border-left:4px solid #007aff; padding:10px 14px; border-radius:6px; margin:4px 0; font-size:15px; white-space:pre-wrap; max-height:40vh; overflow:auto;'>${escapeHTML(msg.content)}</div></div>`;
      }
      return `<div style="margin-bottom:6px;"><b>${msg.role === 'user' ? 'You' : 'GPT'}:</b> ${escapeHTML(msg.content)}</div>`;
    }).join('');
    // --- Render pending message if present and autoApply is false ---
    if (!autoApply && pendingUserMsg && pendingAssistantMsg) {
      html += `<div style="margin-bottom:6px;"><b>You (pending):</b> ${escapeHTML(pendingUserMsg.content)}</div>`;
      if (pendingAssistantMsg.fileName && pendingAssistantMsg.content) {
        // File or patch response
        const isPatch = isV4APatch(pendingAssistantMsg.content);
        html += `<div style="margin-bottom:6px;">
          <b>GPT (pending ${isPatch ? 'patch' : 'file'}):</b>
          <div class="code-block"><pre style='background:#eee; padding:6px; border-radius:4px; overflow:auto;'>${escapeHTML(pendingAssistantMsg.content)}</pre></div>
          <div style='display:flex; gap:8px; margin-top:4px;'>
            <button id='pending-apply-btn'>Apply</button>
            <button id='pending-revert-btn'>Revert</button>
            ${!isPatch ? `<button id='pending-diff-btn'>Show Diff</button>` : ''}
          </div>
          <pre id='pending-diff-area' style='margin-top:6px; background:#f9f9f9; padding:8px; border-radius:6px; overflow:auto; max-height:180px; font-family:monospace; font-size:13px; white-space:pre-wrap; border:1px solid #e0e6ef; display:none;'></pre>
        </div>`;
      } else {
        // Non-file GPT output
        html += `<div style="margin-bottom:6px;"><b>GPT (pending):</b> ${escapeHTML(pendingAssistantMsg.content)}
          <div style='display:flex; gap:8px; margin-top:4px;'>
            <button id='pending-apply-btn'>Apply</button>
            <button id='pending-revert-btn'>Revert</button>
          </div>
        </div>`;
      }
    }
    messagesDiv.innerHTML = html;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    // Collapse/expand all logic
    const collapseAllBtn = container.querySelector('#collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.onclick = () => {
        allCollapsed = !allCollapsed;
        chatHistory.forEach(msg => {
          if (msg.role === 'assistant' && msg.fileName && msg.content) {
            msg.collapsed = allCollapsed;
          }
        });
        // Update icon and tooltip
        const { icon, title } = getCollapseIconAndTitle();
        collapseAllBtn.innerHTML = icon;
        collapseAllBtn.title = title;
        renderMessages();
      };
    }
    // Per-message collapse toggles
    messagesDiv.querySelectorAll('.collapse-toggle').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const msg = chatHistory[idx];
        msg.collapsed = !msg.collapsed;
        renderMessages();
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
    // --- Wire up Apply/Revert for pending message ---
    if (!autoApply && pendingUserMsg && pendingAssistantMsg) {
      const applyBtn = messagesDiv.querySelector('#pending-apply-btn');
      const revertBtn = messagesDiv.querySelector('#pending-revert-btn');
      const diffBtn = messagesDiv.querySelector('#pending-diff-btn');
      const diffArea = messagesDiv.querySelector('#pending-diff-area');
      if (applyBtn) applyBtn.onclick = async () => {
        // Commit to history and apply code if needed
        chatHistory.push(pendingUserMsg);
        userWishes.push(pendingUserMsg.content);
        chatHistory.push(pendingAssistantMsg);
        // Persist
        try {
          localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
          localStorage.setItem('autoregret_user_wishes', JSON.stringify(userWishes));
        } catch (e) {}
        // Apply code if file/patch
        if (pendingAssistantMsg.fileName && pendingAssistantMsg.content) {
          if (isV4APatch(pendingAssistantMsg.content)) {
            try {
              await applyPatchToFS(pendingAssistantMsg.content);
              if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
              chatPlaceholder.textContent = 'Patch applied!';
              if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
            } catch (e) {
              chatPlaceholder.textContent = 'Patch error: ' + e.message;
            }
          } else {
            // Full file
            const fileName = pendingAssistantMsg.fileName;
            const prevFile = await loadFile(fileName);
            if (prevFile) {
              await saveFile({ ...prevFile, content: pendingAssistantMsg.content }, 'wish', pendingUserMsg.content);
              if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
              chatPlaceholder.textContent = 'Patch applied!';
              if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
            }
          }
        }
        // Clear pending state and re-enable input
        pendingUserMsg = null;
        pendingAssistantMsg = null;
        input.disabled = false;
        sendBtn.disabled = false;
        // --- Clear draft on apply ---
        localStorage.removeItem(draftKey);
        if (window.autoregretHighlightSuccess) window.autoregretHighlightSuccess();
        renderMessages();
      };
      if (revertBtn) revertBtn.onclick = () => {
        // Discard pending, do not commit
        pendingUserMsg = null;
        pendingAssistantMsg = null;
        input.disabled = false;
        sendBtn.disabled = false;
        chatPlaceholder.textContent = 'Reverted!';
        // --- Clear draft on revert ---
        localStorage.removeItem(draftKey);
        if (window.autoregretHighlightSuccess) window.autoregretHighlightSuccess();
        renderMessages();
      };
      if (diffBtn && diffArea) {
        let showing = false;
        diffBtn.onclick = async () => {
          if (!showing) {
            diffBtn.textContent = 'Hide Diff';
            diffArea.style.display = '';
            const fileName = pendingAssistantMsg.fileName;
            const newContent = pendingAssistantMsg.content;
            const file = await loadFile(fileName);
            const oldContent = file ? file.content : '';
            const diff = await previewDiff(oldContent, newContent, fileName);
            diffArea.innerHTML = colorizeDiff(diff);
            showing = true;
          } else {
            diffBtn.textContent = 'Show Diff';
            diffArea.style.display = 'none';
            showing = false;
          }
        };
      }
    }
    if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
  }

  sendBtn.onclick = async () => {
    // If recording, treat send as stop+autosend (manual mode only)
    if (isRecording) {
      pendingSendAfterRecording = true;
      stopRecording();
      sendBtn.classList.add('autoregret-send-pulse');
      return;
    }
    const text = input.value.trim();
    if (!text) return;
    // --- Clear draft on send ---
    localStorage.removeItem(draftKey);
    // Remove pulse if present (sending now)
    sendBtn.classList.remove('autoregret-send-pulse');
    // --- Manual mode: store as pending, do not commit ---
    if (!autoApply) {
      pendingUserMsg = { role: 'user', content: text };
      input.value = '';
      input.disabled = true;
      sendBtn.disabled = true;
      chatPlaceholder.textContent = 'Thinking...';
      if (window.setAutoregretThinking) window.setAutoregretThinking(true);
      renderMessages();
      try {
        // Gather file context, wish history, etc (same as before)
        const files = await listFiles();
        const modFiles = files.filter(f => f.modifiable);
        const context = modFiles.map(f => `// File: ${f.name}\n${f.content}`).join('\n\n');
        const wishHistory = userWishes.map((wish, i) => `${i + 1}. ${wish}`).join('\n');
        const allowExternalLibs = localStorage.getItem('autoregret_allow_external_libs') === 'true';
        const diffOnly = getDiffOnly();
        const systemPrompt = buildSystemPrompt({ diffOnly, allowExternalLibs });
        const userPrompt = `${wishHistory && wishHistory.length > 0 ? 'Prior user wishes:\n' + wishHistory + '\n\n' : ''}\n\nHere are all modifiable files in the app:\n\n${context}\n\nUser request: ${text}`;
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];
        const response = await sendPrompt('', messages);
        const match = response.match(/^\s*\/\/\s*File:\s*([\w.\-\/]+)\s*\n([\s\S]*)$/m);
        const promptHistory = { systemPrompt, userPrompt, gptOutput: response };
        if (isV4APatch(response)) {
          const patchFileMatch = response.match(/\*\*\* Update File: ([^\n]+)/);
          const patchFileName = patchFileMatch ? patchFileMatch[1].trim() : '[patch]';
          pendingAssistantMsg = { role: 'assistant', content: response, fileName: patchFileName, promptHistory };
        } else if (match) {
          const fileName = match[1].trim();
          const fileContent = match[2];
          pendingAssistantMsg = { role: 'assistant', content: fileContent, fileName, promptHistory };
        } else {
          pendingAssistantMsg = { role: 'assistant', content: response, promptHistory };
        }
        chatPlaceholder.textContent = 'Choose Apply or Revert.';
        if (window.setAutoregretThinking) window.setAutoregretThinking(false);
        if (window.autoregretHighlightSuccess) window.autoregretHighlightSuccess();
        renderMessages();
        if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
      } catch (e) {
        chatPlaceholder.textContent = 'Error: ' + e.message;
        input.disabled = false;
        sendBtn.disabled = false;
        pendingUserMsg = null;
        pendingAssistantMsg = null;
        if (window.setAutoregretThinking) window.setAutoregretThinking(false);
        if (window.autoregretBlinkError) window.autoregretBlinkError();
        renderMessages();
      }
      return;
    }
    // --- Auto-apply mode: original logic ---
    sendBtn.disabled = true;
    if (window.setAutoregretThinking) window.setAutoregretThinking(true);
    chatHistory.push({ role: 'user', content: text });
    userWishes.push(text);
    // Persist chatHistory and userWishes
    try {
      localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
      localStorage.setItem('autoregret_user_wishes', JSON.stringify(userWishes));
    } catch (e) {}
    renderMessages();
    if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
    input.value = '';
    chatPlaceholder.textContent = 'Thinking...';
    try {
      // Gather file context
      const files = await listFiles();
      const modFiles = files.filter(f => f.modifiable);
      const context = modFiles.map(f => `// File: ${f.name}\n${f.content}`).join('\n\n');
      // Add wish history to the prompt
      // Only include previous wishes, not the current one
      const wishHistory = userWishes.slice(0, -1).map((wish, i) => `${i + 1}. ${wish}`).join('\n');
      const allowExternalLibs = localStorage.getItem('autoregret_allow_external_libs') === 'true';
      const diffOnly = getDiffOnly();
      const systemPrompt = buildSystemPrompt({ diffOnly, allowExternalLibs });
      const userPrompt = `${wishHistory && wishHistory.length > 0 ? 'Prior user wishes:\n' + wishHistory + '\n\n' : ''}\n\nHere are all modifiable files in the app:\n\n${context}\n\nUser request: ${text}`;
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      const response = await sendPrompt('', messages);
      // Try to extract file name and content from response (robust to whitespace)
      const match = response.match(/^\s*\/\/\s*File:\s*([\w.\-\/]+)\s*\n([\s\S]*)$/m);
      const promptHistory = { systemPrompt, userPrompt, gptOutput: response };
      if (isV4APatch(response)) {
        console.log('[AutoRegret] Handling V4A patch response');
        const patchFileMatch = response.match(/\*\*\* Update File: ([^\n]+)/);
        const patchFileName = patchFileMatch ? patchFileMatch[1].trim() : '[patch]';
        let error = undefined;
        // FIX: Push assistant message to chatHistory and update localStorage BEFORE applying patch
        const assistantMsg = { role: 'assistant', content: response, fileName: patchFileName, promptHistory };
        chatHistory.push(assistantMsg);
        try {
          localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
        } catch (e) {}
        try {
          await applyPatchToFS(response);
          if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
          chatPlaceholder.textContent = 'Patch applied!';
          if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
        } catch (e) {
          console.error('[AutoRegret] Patch error:', e);
          error = e.message;
          chatPlaceholder.textContent = 'Patch error: ' + e.message;
        }
        // Optionally update the last assistant message with error info
        if (error) {
          assistantMsg.error = error;
          try {
            localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
          } catch (e) {}
        }
        if (window.setAutoregretThinking) window.setAutoregretThinking(false);
        if (window.autoregretHighlightSuccess) window.autoregretHighlightSuccess();
        renderMessages();
      } else if (match) {
        console.log('[AutoRegret] Handling full file response');
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
            const prevFile = await loadFile(fileName);
            if (prevFile) {
              const prevContent = prevFile.content;
              await saveFile({ ...prevFile, content: fileContent }, 'wish', text);
              if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
              renderMessages();
              chatPlaceholder.textContent = 'Patch auto-applied!';
              if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
            }
            if (window.setAutoregretThinking) window.setAutoregretThinking(false);
            if (window.autoregretHighlightSuccess) window.autoregretHighlightSuccess();
          }, 0);
        } else {
          if (window.setAutoregretThinking) window.setAutoregretThinking(false);
          if (window.autoregretHighlightSuccess) window.autoregretHighlightSuccess();
        }
      } else {
        console.log('[AutoRegret] Unrecognized GPT response format');
        chatHistory.push({ role: 'assistant', content: response, promptHistory });
        // Persist chatHistory
        try {
          localStorage.setItem('autoregret_chat_history', JSON.stringify(chatHistory));
        } catch (e) {}
        if (window.setAutoregretThinking) window.setAutoregretThinking(false);
        if (window.autoregretBlinkError) window.autoregretBlinkError();
      }
      renderMessages();
      chatPlaceholder.textContent = 'Type or record what you want this website to self-modify.';
      if (window.autoregretUpdateUndoBtnState) window.autoregretUpdateUndoBtnState();
    } catch (e) {
      console.error('[AutoRegret] sendBtn error:', e);
      chatPlaceholder.textContent = 'Error: ' + e.message;
      if (/401|unauthorized|invalid api key|invalid authentication/i.test(e.message)) {
        chatPlaceholder.style.color = '#b31d28'; // red
      } else {
        chatPlaceholder.style.color = '#888'; // default
      }
      if (window.setAutoregretThinking) window.setAutoregretThinking(false);
      if (window.autoregretBlinkError) window.autoregretBlinkError();
    }
    sendBtn.disabled = false;
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  renderMessages();
}

// Pretty diff colorizer
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
