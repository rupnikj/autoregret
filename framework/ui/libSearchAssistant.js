// External Library Search Assistant for AutoRegret
// This module is self-contained and can be triggered from the chat UI.
// It uses OpenAI function-calling with cdnjs tool schemas to recommend suitable external JS libraries.

import { cdnjsTools, getApiKey, getModel } from '../core/gpt.js';
import { searchCdnjsLibraries, getCdnjsLibraryMeta, getJsDelivrMeta } from '../core/libDiscover.js';

/**
 * Run the library search assistant loop.
 * @param {Object} opts
 * @param {string} opts.code - All modifiable file contents (string)
 * @param {string[]} opts.wishHistory - Previous user wishes
 * @param {string} opts.currentWish - The current user wish
 * @param {string[]} opts.blacklist - List of blacklisted library names or URLs
 * @returns {Promise<{candidates: Array, rawResponse: any}>}
 */
export async function runLibrarySearchAssistant({ code, wishHistory, currentWish, blacklist }) {
  console.log(`Running library search assistant for wish:\n    ${currentWish}\nUsing blacklist: [${blacklist.join(', ')}]`);
  if (!getApiKey()) throw new Error('OpenAI API key not set.');
  // Compose system prompt
  const systemPrompt = `You are a javascript external library search assistant. You are a part of a system that involves an AI assistant that implements user's wishes in a self-modifying web app (html + javascript).
Given current application source code, user's previous wishes that the AI assistant used to implement it and the current wish, the goal of the AI assistant is to implement the current wish.
It might require access to an external library or might not. 
Your task is to recommend any additional external libraries which the AI assistant will use. The assistant can only use the list you provide. You can extend the list with additional external libraries or not when
the current wish does not need additional libs.
The libraries must use the umd/global object pattern and not ESM (module, import). They have to be pure javascript and not css or typescript. We have a blacklist of libs that we verified are not suitable.
- You have access to the following tools to help you discover and verify libraries:
  - searchCdnjsLibraries(keyword): Search cdnjs for libraries by keyword.
  - getCdnjsLibraryMeta(libName): Get metadata of a cdnjs library - versions and the list of files for the latest version
  - getJsDelivrMeta(libName): Get metadata of the latest versions fo a library from jsDelivr
The search is useful to get alternative libs and the metadata is useful to help select a concrete file (sometimes the name itself tells you that it's umd, so a good candidate).
By calling the tools you should come up with a list of candidates to verify. If the candidates pass we are done, otherwise we will continue searching (the blacklist of files will include
libraries that failed to meet our criteria)
- Use searchCdnjsLibraries if you are unsure which lib to use (maybe the initial guess was blacklisted).
- Use getCdnjsLibraryMeta to get a list of valid files so we don't waste time on 404 errors. We also want the latest version of the lib (security reasons).
- Use getJsDelivrMeta to get metadata from jsDelivr using npm package name.
- When using jsDelivr you have to try npm package names without resorting to any search, for packages you remember can be useful.
- Your final answer should be a JSON with two fields: reasoning (string) and candidates (list of complete ulr strings)

`;
  // Compose user prompt
  const userPrompt = `Current code:\n${code}\n\nWish history:\n${wishHistory.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nCurrent wish:\n${currentWish}\n\nLibraries that do not work (blacklist):\n${blacklist.join(', ')}`;

  // Prepare messages
  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  // Function call loop
  let candidates = [];
  let rawResponse = null;
  let done = false;
  while (!done) {
    // Call OpenAI with function-calling
    const apiKey = getApiKey();
    const model = getModel();
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model,
      messages,
      temperature: 0.2,
      tools: cdnjsTools,
      tool_choice: 'auto',
      response_format: { type: 'json_object' }
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
    const msg = data.choices?.[0]?.message;
    rawResponse = data;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // 1. Append the assistant message with tool_calls
      messages.push(msg);
      // 2. For each tool call, append a tool message
      for (const toolCall of msg.tool_calls) {
        let toolResult;
        if (toolCall.function?.name === 'searchCdnjsLibraries') {
          const args = JSON.parse(toolCall.function.arguments);
          toolResult = await searchCdnjsLibraries(args.keyword);
        } else if (toolCall.function?.name === 'getCdnjsLibraryMeta') {
          const args = JSON.parse(toolCall.function.arguments);
          toolResult = await getCdnjsLibraryMeta(args.libName);
        } else if (toolCall.function?.name === 'getJsDelivrMeta') {
          const args = JSON.parse(toolCall.function.arguments);
          toolResult = await getJsDelivrMeta(args.libName);
        } else {
          toolResult = { error: 'Unknown tool' };
        }
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(toolResult)
        });
      }
      continue;
    } else {
      // Final answer (should be a list of candidates or none needed)
      // Try to extract candidates from the response
      let content = msg.content || '';
      try {
        // Try to parse as JSON if possible
        if (content.trim().startsWith('{')) {
          const json = JSON.parse(content);
          candidates = json.candidates;
          console.log('Library search assistant reasoning:', json.reasoning);
        } else {
          // Try to extract URLs from text
          const urlRegex = /https?:\/\/[^\s'"\]\)]+/g;
          candidates = content.match(urlRegex) || [];
        }
      } catch (e) {
        candidates = [];
      }
      done = true;
    }
  }
  console.log('Library search assistant candidates:', candidates);
  return { candidates, rawResponse };
} 