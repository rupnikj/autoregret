# AutoRegret Technical Summary

## Overview

AutoRegret is a self-modifying, client-side web application that allows users to interactively modify its own code through a floating UI panel powered by OpenAI's GPT models. All code and data are stored in the browser using IndexedDB and localStorage. The app is frameworkless (vanilla JS), and all logic runs in the browser—there is no backend except for OpenAI API calls.

---

## Architecture

### 1. Entry Point
- **`main.js`**: Initializes the app by setting up storage, the floating UI panel, and loading the user app code from the virtual file system.

### 2. Virtual File System
- **`framework/core/storage.js`**: Implements a virtual file system using IndexedDB. Supports file CRUD, version history, and seeding initial files from `/app/`.
- **Files**: Each file is an object with `name`, `content`, `modifiable`, and `framework` fields. All user-editable code lives here.

### 3. User App Loading
- **`framework/core/appLoader.js`**: Loads all `.js` files from the virtual FS, concatenates and evals them in the global scope. Ensures `window.App` is set and calls `App.init()` if present. Handles cleanup via `App.cleanup()` if defined.

### 4. UI Panel (Shadow DOM)
- **`framework/ui/panel.js`**: Renders a floating panel with tabs for Chat, Editor, and History. Handles settings (API key/model), data purge, and download as HTML bundle.
- **Tabs:**
  - **Editor**: Code editor for all modifiable files (CodeMirror via CDN).
  - **Chat**: Conversational interface to GPT for code changes, with auto-apply and diff/revert features.
  - **History**: View and restore previous file versions.

### 5. Chat & AI Integration
- **`framework/ui/chat.js`**: Handles chat UI, voice input (Web Audio + OpenAI transcription), and communication with GPT. Applies code changes suggested by GPT directly to the virtual FS, with auto-apply and diff preview.
- **`framework/core/gpt.js`**: Manages OpenAI API key/model and sends prompts to the GPT API. All prompts are constructed to ensure only one file is changed at a time, and only file content is returned (no commentary/diffs).

### 6. Diff & Patch
- **`framework/core/diffEngine.js`**: Uses the `diff` library (via CDN) to generate and apply unified diffs between file versions.

### 7. Code Editor
- **`framework/ui/editor.js`**: Provides a file picker and code editor (CodeMirror) for direct editing of any modifiable file.

### 8. File History
- **`framework/ui/history.js`**: UI for browsing and restoring previous versions of files, using the version history stored in IndexedDB.

### 9. User App
- **`app/App.js`**: The main user app entry point. Must export `App` with at least an `init()` method. All UI is rendered into the `#autoregret-root` div. Example shows a simple button and message.
- **`app/utils.js`**: Placeholder for user utility functions.
- **`app/config.json`**: Example config file, loaded into the virtual FS.

---

## Key Assumptions & Framework
- **No frameworks**: Pure vanilla JS, no React/Vue/Angular, no Node.js, no backend except OpenAI API.
- **Virtual FS**: All code/data is stored in the browser (IndexedDB/localStorage). No server-side persistence.
- **Self-modifying**: The app can rewrite its own code via the Chat tab, using GPT as a code assistant.
- **Security**: All code is eval'd in the browser. There is a placeholder for sandboxing, but no real isolation—malicious code can break the app.
- **App Lifecycle**: `App.init()` is called to start the user app. If code is updated, `App.cleanup()` is called before reloading.
- **Single-file edits**: All GPT-driven changes are restricted to a single file at a time, and only the full file content is returned/applied.
- **Voice input**: Uses browser audio APIs and OpenAI's transcription endpoint for voice-to-text in chat.
- **Panel UI**: Rendered in a Shadow DOM to avoid CSS/JS conflicts with the user app.

---

## How It Works (Flow)
1. **Startup**: `main.js` initializes storage, the UI panel, and loads the user app from the virtual FS.
2. **User Interaction**: The floating panel provides tabs for editing, chatting, and history.
3. **Chat-driven Edits**: User requests changes in Chat. The system sends all modifiable files and the user prompt to GPT, which returns a new file version. The change is auto-applied (if enabled), and the app reloads.
4. **Manual Edits**: User can edit files directly in the Editor tab, or apply diffs in the Diff tab.
5. **History**: All file changes are versioned. The user can restore any previous version from the History tab.
6. **Persistence**: All changes are stored in the browser. The app can be reset (purged) from the panel.

---

## Security & Limitations
- **No real sandboxing**: All code runs in the main browser context. Malicious code can break the app or access browser APIs.
- **No backend**: All logic is client-side except for OpenAI API calls.
- **Single-user**: No multi-user or collaboration features.
- **Prototype**: Intended for experimentation, not production use.

---

## File Map
- `main.js` — Entry point
- `framework/core/` — Storage, app loading, diff, GPT integration
- `framework/ui/` — Panel, chat, editor, diff, history UIs
- `app/` — User app code (modifiable)

---

## External Library Loader (CDNJS Only)
- The framework provides a generic `loadExternalLibrary` function (see `framework/core/libLoader.js`).
- Usage: `loadExternalLibrary({ globalVar, url, onload })`.
  - Example: `{ globalVar: 'pdfjsLib', url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js', onload: ... }`
- Only loads from cdnjs.cloudflare.com.
- Persists loaded libraries in localStorage and auto-loads them on startup.
- AI is prompted to use this loader for any new library needed by user wishes, never hardcoding library URLs in the framework.

---

## AI Prompt Adaptation
- If a user wish requires a new JS library, use `loadExternalLibrary` by importing it directly from `../framework/core/libLoader.js`.
- Only load from cdnjs (cdnjs.cloudflare.com).
- Do not hardcode library URLs in the framework; always use the loader.
- Example usage in user code:
  ```js
  loadExternalLibrary({
    globalVar: 'pdfjsLib',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.js',
    onload: () => {
      // Use window.pdfjsLib here
    }
  });
  ```

---

For more details, see `AutoRegret-Spec.md`.