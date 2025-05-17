// V4A Patch Parser and Applier for AutoRegret
// Implements the V4A diff/patch format as described in OpenAI's guidelines

/**
 * Usage:
 *   const result = applyV4APatch(patchText, files);
 *   // result: { updatedFiles, deletedFiles, addedFiles }
 *
 * - patchText: string (V4A patch format)
 * - files: { [filename]: fileContent }
 *
 * Returns: { updatedFiles, deletedFiles, addedFiles }
 */

class DiffError extends Error {}

function parsePatch(patchText) {
  const lines = patchText.split(/\r?\n/);
  let i = 0;
  function nextLine() { return lines[i++]; }
  function peekLine() { return lines[i]; }
  function expectLine(expected) {
    const line = nextLine();
    if (line !== expected) throw new DiffError(`Expected '${expected}', got '${line}'`);
  }

  // Sentinel
  if (!lines[0].startsWith('*** Begin Patch')) throw new DiffError('Missing *** Begin Patch');
  i = 1;
  const actions = [];
  while (i < lines.length) {
    let line = lines[i];
    if (line === '*** End Patch') break;
    if (line.startsWith('*** Update File: ')) {
      const filename = line.slice(17);
      i++;
      // Optionally: *** Move to: ... (not implemented)
      const chunks = [];
      // Robust chunk parsing: always parse a chunk after every @@, and at the start if needed
      while (i < lines.length) {
        line = lines[i];
        if (line === undefined || line.startsWith('***')) break;
        if (line.startsWith('@@')) {
          // Start of a new chunk
          i++;
          let chunkLines = [];
          while (i < lines.length) {
            line = lines[i];
            if (line === undefined || line.startsWith('***') || line.startsWith('@@')) break;
            if (/^[ +-]/.test(line)) {
              chunkLines.push(line);
            } else if (line === '') {
              chunkLines.push(' ');
            } else {
              chunkLines.push(' ' + line);
            }
            i++;
          }
          if (chunkLines.length > 0) {
            console.log('[V4APatch] Parsed chunk (after @@):', chunkLines);
            chunks.push({ lines: chunkLines });
          }
        } else if (/^[ +-]/.test(line)) {
          // Chunk at the start (no @@)
          let chunkLines = [];
          while (i < lines.length) {
            line = lines[i];
            if (line === undefined || line.startsWith('***') || line.startsWith('@@')) break;
            if (/^[ +-]/.test(line)) {
              chunkLines.push(line);
            } else if (line === '') {
              chunkLines.push(' ');
            } else {
              chunkLines.push(' ' + line);
            }
            i++;
          }
          if (chunkLines.length > 0) {
            console.log('[V4APatch] Parsed chunk (top-level, no @@):', chunkLines);
            chunks.push({ lines: chunkLines });
          }
        } else {
          // Skip or treat as context (robust)
          i++;
        }
      }
      if (chunks.length === 0) throw new DiffError('No chunks found in update section');
      actions.push({ type: 'update', filename, chunks });
      continue;
    } else if (line.startsWith('*** Add File: ')) {
      const filename = line.slice(14);
      i++;
      const content = [];
      while (i < lines.length) {
        line = lines[i];
        if (line === undefined || line.startsWith('***')) break;
        if (line.startsWith('+')) {
          content.push(line.slice(1));
        } else if (line === '') {
          content.push('');
        } else {
          throw new DiffError(`Invalid line in Add File: ${line}`);
        }
        i++;
      }
      actions.push({ type: 'add', filename, content: content.join('\n') });
      continue;
    } else if (line.startsWith('*** Delete File: ')) {
      const filename = line.slice(17);
      i++;
      actions.push({ type: 'delete', filename });
      continue;
    } else if (line === '' || line.startsWith('@@')) {
      i++;
      continue;
    } else {
      throw new DiffError(`Unknown line in patch: ${line}`);
    }
  }
  return actions;
}

function applyUpdateChunk(origLines, chunkLines) {
  // chunkLines: array of lines starting with ' ', '+', or '-'
  // Apply the chunk to origLines, return new lines
  // Robust: handle contextless (no ' ' lines) and contextful chunks
  let i = 0;
  let j = 0;
  const result = [];
  // If the chunk has no context lines, treat as a search/replace for the - line
  const hasContext = chunkLines.some(l => l.startsWith(' '));
  if (!hasContext) {
    // Find the first - line in chunk
    const minusIdx = chunkLines.findIndex(l => l.startsWith('-'));
    if (minusIdx === -1) {
      // No - line, just additions: insert at start
      for (const l of chunkLines) {
        if (l.startsWith('+')) result.push(l.slice(1));
      }
      result.push(...origLines);
      console.log('[V4APatch] No - line, only additions. Inserted at start.');
      return result;
    }
    const minusLine = chunkLines[minusIdx].slice(1);
    // Find the first occurrence of minusLine in origLines
    const matchIdx = origLines.findIndex(l => l === minusLine);
    if (matchIdx === -1) {
      console.warn('[V4APatch] - line not found in file. Patch may be invalid.', minusLine);
      return origLines;
    }
    // Copy lines up to match
    for (let k = 0; k < matchIdx; k++) result.push(origLines[k]);
    // Replace - line with + lines
    for (const l of chunkLines) {
      if (l.startsWith('+')) result.push(l.slice(1));
    }
    // Skip the - line in origLines
    let skip = 1;
    // If there are multiple - lines, skip them all
    for (let k = minusIdx + 1; k < chunkLines.length; k++) {
      if (chunkLines[k].startsWith('-')) skip++;
      else break;
    }
    for (let k = matchIdx + skip; k < origLines.length; k++) result.push(origLines[k]);
    console.log('[V4APatch] Contextless patch: replaced line', minusLine, 'at', matchIdx);
    return result;
  }
  // Contextful chunk: original logic
  while (i < chunkLines.length) {
    const line = chunkLines[i];
    if (line.startsWith(' ')) {
      // Context line
      if (origLines[j] !== undefined && origLines[j] === line.slice(1)) {
        result.push(origLines[j]);
        j++;
      } else {
        // Fuzzy match: skip context if not found
        result.push(line.slice(1));
      }
      i++;
    } else if (line.startsWith('-')) {
      // Remove line
      if (origLines[j] === line.slice(1)) {
        j++;
      }
      i++;
    } else if (line.startsWith('+')) {
      // Add line
      result.push(line.slice(1));
      i++;
    } else {
      // Blank or unknown
      i++;
    }
  }
  // Add any remaining lines
  while (j < origLines.length) {
    result.push(origLines[j++]);
  }
  return result;
}

export function applyV4APatch(patchText, files) {
  // files: { [filename]: content }
  const actions = parsePatch(patchText);
  const updatedFiles = {};
  const deletedFiles = [];
  const addedFiles = {};
  for (const action of actions) {
    if (action.type === 'update') {
      if (!(action.filename in files)) throw new DiffError(`File not found: ${action.filename}`);
      let origLines = files[action.filename].split(/\r?\n/);
      for (const chunk of action.chunks) {
        origLines = applyUpdateChunk(origLines, chunk.lines);
      }
      updatedFiles[action.filename] = origLines.join('\n');
    } else if (action.type === 'add') {
      if (action.filename in files) throw new DiffError(`File already exists: ${action.filename}`);
      addedFiles[action.filename] = action.content;
    } else if (action.type === 'delete') {
      if (!(action.filename in files)) throw new DiffError(`File not found: ${action.filename}`);
      deletedFiles.push(action.filename);
    }
  }
  return { updatedFiles, deletedFiles, addedFiles };
}

export class V4APatchError extends DiffError {} 