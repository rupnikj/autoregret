# AutoRegret – A Self-Modifying Frontend App

## 🧠 Motivation

**AutoRegret** is a personal experiment in building a JavaScript frontend application that can modify itself in real time using natural language input and the power of OpenAI’s GPT API. The goal is to create a system that can take a user prompt (e.g., "make the button red") and apply the necessary code changes automatically — with versioning, safety, and self-awareness.

The app aims to explore:
- What development feels like when code responds to intent instead of keystrokes
- How much responsibility can be offloaded to an LLM in a live-editing system
- What safety nets are required when an app can mutate itself

This project is intentionally named **AutoRegret**, because… we all know how this ends.

---

## 🛠️ Scope

- Pure frontend, **no backend**
- **Client-side only** (host on GitHub Pages or similar)
- Built for **personal use / prototyping**, not production
- **OpenAI API key stored in `localStorage`** (not secure — acceptable for solo use)
- **Persistent app code storage and history via IndexedDB**
- Built-in **self-modification UI** isolated from the running app
- GPT receives the **entire app context** with every request

---

## ⚠️ Limitations

- No secure handling of secrets
- No user accounts or syncing across devices
- GPT may produce invalid diffs or hallucinated frameworks (partially mitigated by prompt engineering)
- Full app context sent per edit (not optimized for scale)
- Rollback is available but basic
- App can crash if GPT output is applied without sandbox testing

---

## 🧱 Tech Stack

| Layer            | Tool / Library              |
|------------------|-----------------------------|
| Editor           | [CodeMirror 6](https://codemirror.net/) |
| Diffing          | `diff-match-patch` or `jsdiff` |
| Storage          | `IndexedDB` via wrapper     |
| LLM Interface    | OpenAI GPT-4.1 API      |
| Code Execution   | `eval()` (then dynamic `import()` via blob) |
| System UI        | Shadow DOM-based floating panel |
| Testing Sandbox  | `try/catch` eval test       |


## 🧭 High-Level Architecture

```
+––––––––––––––+
|     AutoRegret Framework  |
+––––––––––––––+
|  - Shadow UI Panel        |
|  - Editor & Chat          |
|  - Diff Engine            |
|  - IndexedDB FS           |
|  - GPT API Client         |
|  - Patch Validator        |
+––––––––––––––+
|
v
+––––––––––––––+
|     User App Code         |
+––––––––––––––+
|  - Lives in memory + FS   |
|  - Executed via eval()    |
|  - Reloaded on patch      |
+––––––––––––––+
```

## 🧩 Main Components

### 1. **Shadow UI Panel**
- Renders in a Shadow DOM root for full CSS isolation
- Fixed-position floating panel (draggable)
- UI tabs:
  - **Editor**: CodeMirror for viewing/editing files
  - **Diff Preview**: View GPT-generated code changes before applying
  - **Chat**: Send requests ("make the button red")
  - **History**: Restore previous versions

### 2. **Virtual File System**
- Files stored in memory and IndexedDB
- Each file is a JSON object:
```json
{
  "name": "App.js",
  "content": "...",
  "modifiable": true,
  "framework": "vanilla",
  "lastModified": 1681234567890
}
```
- All code edits read/write from this structure

### 3. Chat Interface + Prompt Compiler
- User enters plain-English prompt
- System injects:
- Current file contents
- Framework tag (e.g., vanilla, react)
- Constraints (e.g., “Do not change framework”)
- Combined into structured GPT prompt

### 4. GPT Interface
- Uses GPT-4.1 via OpenAI API
- API key stored in localStorage
- Receives prompt + file context
- Responds with:
- Preferred: Diff format
- Fallback: Full file replacements

### 5. Diff Engine
- Uses jsdiff or similar to:
- Show side-by-side preview
- Apply changes to virtual FS
- If errors occur, patch is discarded and user notified

### 6. Patch Validator
- Applies patch in memory
- Runs test via try { eval(code) }
- If no error: patch is saved, version is updated, and app is reloaded
- If error: revert and alert via badge and overlay

### 7. App Loader
- User app code stored in virtual FS
- Combined and eval()’d into window.App namespace
- Reload on change calls App.init() or equivalent
- Future: switch to import(blobURL) for cleaner modularity
	
```
/autoregret/
├── index.html
├── main.js                   # Entry point: initializes framework + loads user app
├── framework/
│   ├── ui/
│   │   ├── panel.js          # Floating Shadow DOM panel
│   │   ├── editor.js         # CodeMirror integration
│   │   ├── diff.js           # Renders GPT-generated diffs
│   │   └── chat.js           # Handles user input and GPT responses
│   ├── core/
│   │   ├── gpt.js            # OpenAI GPT API client
│   │   ├── diffEngine.js     # Applies and validates diffs
│   │   ├── sandbox.js        # `try/catch` eval validator
│   │   └── storage.js        # IndexedDB file store
├── app/                      # User-modifiable app code
│   ├── App.js
│   ├── utils.js
│   └── config.json
├── data/                     # IndexedDB logic (virtual FS mirror)
│   └── files.db
├── styles/
│   └── ui.css
└── README.md
```

### 🧪 Workflow Example
- User prompt: “Make the header text red”
- Compiler:
  - Collects all files marked modifiable
  - Adds system instructions: “Do not change framework”, etc.
- GPT response:
  - A diff for App.js modifying a CSS class
- Diff Engine:
  - Applies patch in-memory
  - Validates via eval() test
- If valid:
  - Save new version to IndexedDB
  - Reload app from virtual FS
- If invalid:
 - Display warning badge + diff viewer
 - Discard patch and await next prompt



### 🧰 Default Constraints Injected into GPT Prompt
- This is a JavaScript frontend app using [vanilla | React | Vue].
- Do not change the framework.
- Only modify files marked as `modifiable`.
- Use clean, minimal changes.
- Prefer diffs over full file replacements.
- Assume the user app starts with `App.init()` as its entry point.


### 🔚 Conclusion

AutoRegret is an experiment in letting your app write its own future using chat gpt. It’s an isolated, frontend-only playground for building a natural-language-powered live development environment, backed by a virtual file system, GPT-driven patching, and versioned self-modification.



