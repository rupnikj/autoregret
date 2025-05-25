// OpenAI GPT API client

const API_KEY_STORAGE = 'autoregret_openai_api_key';
const MODEL_STORAGE = 'autoregret_openai_model';
const DEFAULT_MODEL = 'gpt-4.1';

export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setModel(model) {
  localStorage.setItem(MODEL_STORAGE, model);
}

export function getModel() {
  return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
}

export async function sendPrompt(prompt, messages = null) {
  const apiKey = getApiKey();
  const model = getModel();
  if (!apiKey) throw new Error('OpenAI API key not set.');
  const url = 'https://api.openai.com/v1/chat/completions';
  const chatMessages = messages || [
    { role: 'system', content: 'You are a helpful AI code assistant.' },
    { role: 'user', content: prompt }
  ];
  const body = {
    model,
    messages: chatMessages,
    temperature: 0.2
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Tool schemas for cdnjs library discovery (OpenAI function-calling)
export const cdnjsTools = [
  {
    type: "function",
    function: {
      name: "searchCdnjsLibraries",
      description: "Search cdnjs for libraries matching a keyword.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword" }
        },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getCdnjsLibraryMeta",
      description: "Get metadata (versions, files) for a cdnjs library.",
      parameters: {
        type: "object",
        properties: {
          libName: { type: "string", description: "Library name" }
        },
        required: ["libName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getJsDelivrMeta",
      description: "Get latest version and files for an npm package from jsdelivr.",
      parameters: {
        type: "object",
        properties: {
          libName: { type: "string", description: "npm package name" }
        },
        required: ["libName"]
      }
    }
  }
]; 