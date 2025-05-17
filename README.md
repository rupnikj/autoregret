# AutoRegret

A self-modifying frontend app experiment powered by GPT-4 and a virtual file system. See `AutoRegret-Spec.md` for full details and architecture.

## Quick Start

1. **Clone this repository and cd into the directory:**
   ```sh
   git clone https://github.com/rupnikj/autoregret.git && cd autoregret
   ```
2. **Run a local server** in the project directory (e.g. `python3 -m http.server` or `npx serve`).
3. **Open your browser and go to** [http://localhost:8000](http://localhost:8000) (or the port your server uses).
4. The floating panel UI will appear; the user app loads in the main area.
5. **Set your OpenAI API key** using the settings (⚙️) button in the panel. The key is stored in your browser's local storage and not sent anywhere.
6. **Navigate to the Chat tab and type your wish for what the app should self modify to (examples: `blue background`, `add a midi piano`, `make a fish that floats`, `make it snow`).**

---

- All code and app data are stored **entirely in your browser's local storage** (IndexedDB and localStorage).
- No data is sent to any backend except OpenAI API calls you initiate.
- Use the floating panel to chat, edit, and view history.

---

**Warning:** This is a prototype and will mutate itself. See the spec for limitations and safety notes. 