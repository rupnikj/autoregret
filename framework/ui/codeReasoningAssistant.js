// Code Reasoning Assistant for AutoRegret
// This module is self-contained and can be triggered from the chat UI.
// It uses OpenAI o4-mini to provide detailed reasoning and suggestions for the current user wish.

import { getApiKey } from '../core/gpt.js';

/**
 * Run the code reasoning assistant.
 * @param {Object} opts
 * @param {string} opts.code - All modifiable file contents (string)
 * @param {string[]} opts.wishHistory - Previous user wishes
 * @param {string} opts.currentWish - The current user wish
 * @returns {Promise<{reasoning: string, rawResponse: any}>}
 */
export async function runCodeReasoningAssistant({ code, wishHistory, currentWish }) {
  console.log(`Running code reasoning assistant for wish:\n    ${currentWish}`);
  if (!getApiKey()) throw new Error('OpenAI API key not set.');
  // Compose system prompt
  const systemPrompt = `
You are a senior JavaScript code reasoning assistant.

You are part of a system that implements user wishes in a self-modifying web app (HTML + JavaScript).

You will be shown:
- The current application source code (all modifiable files)
- The user's previous wishes (requests)
- The current wish (typically a bug report, feature request, or issue)

Your job is to provide a detailed, step-by-step reasoning and actionable suggestions for how to address the current wish.

IMPORTANT CONTEXT FOR YOUR REASONING:
- Your output will be shown to another AI assistant (the "implementing assistant") that will do the coding.
- The implementing assistant can only make a SINGLE edit at a time (one file, one change per response) and it has to fulfill the user's wish (one-shot).
- The implementing assistant is strictly forbidden from using any external JavaScript libraries, CDN scripts, or loading code from the internet, UNLESS it is explicitly specified by the user's wish which libraries (URLs) are allowed.
- The implementing assistant will receive very explicit instructions and constraints (e.g., no frameworks, no Node.js, no backend, only vanilla JS, no new files unless allowed, etc.).
- The implementing assistant will see your reasoning that will help guide the implementation.

How to reason:
- Be specific and reference relevant files, functions, or code blocks.
- If the wish is ambiguous, do your best to interpret it, you may not request feedback from the user!
- If the wish is a bug, hypothesize causes and suggest debugging steps.
- If the wish is a feature, outline the main steps to implement it.
- If the wish is a refactor or improvement, explain the rationale and the safest way to proceed.
- The coding assistant is capable of handling details except when debugging, so no need to spell out the full implementation - that's his job.
`;
  // Compose user prompt
  const userPrompt = `Current code:\n${code}\n\nWish history:\n${wishHistory.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nCurrent wish:\n${currentWish}`;

  // Prepare messages
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  // Call OpenAI o4-mini
  const apiKey = getApiKey();
  const model = 'o4-mini';
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model,
    messages
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
  const reasoning = data.choices?.[0]?.message?.content || '';
  return { reasoning, rawResponse: data };
} 