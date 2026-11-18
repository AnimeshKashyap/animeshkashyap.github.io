/** Split at content boundaries, never inventing or repeating record copy. */
export function replyBubbles(blocks: readonly string[]): string[] {
  const bubbles: string[] = [];
  for (const block of blocks) {
    // Prefer paragraphs, then lines/sentences; unusually long fields wrap at words.
    const parts = block.trim().split(/\n\s*\n|\n|(?<=[a-z0-9)][.!?])\s+(?=[A-Z])/u);
    let current = '';
    for (const part of parts) {
      const words = part.trim().split(/\s+/u);
      let line = '';
      for (let word of words) {
        if (line && line.length + word.length + 1 > 400) {
          if (current) bubbles.push(current);
          bubbles.push(line);
          current = '';
          line = '';
        }
        // A token without word boundaries still has to respect the hard limit.
        while (word.length > 400) {
          if (current) bubbles.push(current);
          current = '';
          bubbles.push(word.slice(0, 400));
          word = word.slice(400);
        }
        line += `${line ? ' ' : ''}${word}`;
      }
      if (!line) continue;
      if (current && current.length + line.length + 1 <= 400) {
        current += `\n${line}`;
      } else {
        if (current) bubbles.push(current);
        current = line;
      }
    }
    if (current) bubbles.push(current);
  }
  // Five is a soft limit: retain all grounded content rather than truncate it.
  while (bubbles.length > 5) {
    let best = -1;
    let shortest = Infinity;
    for (let index = 0; index < bubbles.length - 1; index += 1) {
      const length = bubbles[index]!.length + bubbles[index + 1]!.length + 2;
      if (length <= 400 && length < shortest) {
        best = index;
        shortest = length;
      }
    }
    if (best === -1) break;
    bubbles.splice(best, 2, `${bubbles[best]}\n\n${bubbles[best + 1]}`);
  }
  return bubbles;
}

/** A heading/lead-in and its details are separate conversational units. */
export function recordBubbles(text: string): string[] {
  const boundary = text.search(/\n|(?<=[.!?])\s+(?=[A-Z])/u);
  if (boundary === -1) return replyBubbles([text]);
  return replyBubbles([text.slice(0, boundary), text.slice(boundary).trim()]);
}
