import { describe, expect, it } from 'vitest';
import { composeReply } from './compose';
import { resolveIntent } from './intents';
import { replyBubbles } from './bubbles';
import { getRecords } from '../knowledge';
import { CHATBOT_CONFIG } from '../config';

describe('grounded conversational composition', () => {
  it.each(getRecords())('bounds and joins the $id reply without invented words', (record) => {
    const reply = composeReply([{ record, score: 1 }], record.title);
    expect(reply.text).toBe(reply.bubbles.join('\n\n'));
    expect(reply.bubbles.length).toBeLessThanOrEqual(5);
    expect(reply.bubbles.every((bubble) => bubble.length > 0 && bubble.length <= 400)).toBe(true);
    expect(reply.sources).toEqual([{ id: record.id, label: record.source }]);
    const corpus = `${record.title} ${record.text} Period Stack Location @`.match(/[\p{L}\p{N}+#@]+/gu)!;
    for (const word of reply.text.match(/[\p{L}\p{N}+#@]+/gu)!) {
      expect(corpus).toContain(word);
    }
    if (record.text.includes('\n') || record.type === 'faq') {
      expect(reply.bubbles.length).toBeGreaterThan(1);
    }
  });

  it.each([
    ['hello', [], 2], ['help', [], 2], ['download cv', ['cv'], 1],
    ['email him', ['email'], 1], ['open linkedin', ['linkedin'], 1],
    ['open github', ['github'], 1], ['show projects', ['projects'], 1],
    ['email his cv', ['email', 'cv'], 1],
  ] as const)('evaluates the %s intent without padding short answers', (query, actions, count) => {
    const reply = resolveIntent(query)!;
    expect(reply.bubbles).toHaveLength(count);
    expect(reply.text).toBe(reply.bubbles.join('\n\n'));
    expect(reply.actions).toEqual(actions);
    expect(reply.suggestions).toEqual(CHATBOT_CONFIG.suggestedQuestions);
    expect(reply.sources).toEqual([]);
  });

  it('keeps absence concise rather than inventing a second bubble', () => {
    const reply = composeReply([], 'unknown');
    expect(reply.bubbles).toEqual(["I don't have that in the CV."]);
    expect(reply.actions).toEqual(['email']);
    expect(reply.confident).toBe(false);
  });

  it.each(['experience', 'project', 'skill', 'education'] as const)('splits aggregate %s lists while retaining every source', (type) => {
    const records = getRecords().filter((record) => record.type === type);
    const reply = composeReply(records.map((record) => ({ record, score: 1 })), type);
    expect(reply.bubbles.length).toBeGreaterThan(1);
    expect(reply.bubbles.length).toBeLessThanOrEqual(5);
    expect(reply.bubbles.every((bubble) => bubble.length <= 400)).toBe(true);
    expect(reply.sources).toHaveLength(records.length);
    for (const record of records) {
      expect(reply.sources.some((source) => source.id === record.id)).toBe(true);
    }
    expect(reply.text).toBe(reply.bubbles.join('\n\n'));
  });

  it('orders dated education newest-first without changing source content', () => {
    const records = getRecords().filter((record) => record.type === 'education');
    const hits = records.map((record, index) => ({
      record: { ...record, text: `Period: ${2020 - index}\n${record.text}` }, score: 1,
    }));
    const reply = composeReply([...hits].reverse(), 'education');
    expect(reply.sources.map((source) => source.id)).toEqual(records.map((record) => record.id));
  });

  it('wraps oversized prose without dropping words', () => {
    const text = Array.from({ length: 150 }, () => 'grounded').join(' ');
    const bubbles = replyBubbles([text]);
    expect(bubbles.every((bubble) => bubble.length <= 400)).toBe(true);
    expect(bubbles.join(' ')).toBe(text);
  });
});
