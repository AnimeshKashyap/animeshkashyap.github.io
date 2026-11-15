import { getRecords } from '../knowledge';
import type { ChatEngine, Reply } from '../types';
import { composeReply } from './compose';
import { resolveIntent } from './intents';
import { createSearcher, type Searcher } from './search';

/**
 * Deterministic chat pipeline: intent routing, then retrieval + compose.
 * Returns `ActionId`s only; action execution stays in `actions.ts`.
 */
export function createEngine(): ChatEngine {
  let searcher: Searcher | undefined;

  function retrievalSearch(query: string) {
    searcher ??= createSearcher(getRecords());
    return searcher.search(query);
  }

  return {
    async ask(query: string): Promise<Reply> {
      const intent = resolveIntent(query);
      if (intent !== null) {
        return intent;
      }
      const hits = retrievalSearch(query);
      return composeReply(hits, query);
    },
  };
}