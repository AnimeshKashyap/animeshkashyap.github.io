# Portfolio chatbot

Retrieval-only assistant: no LLM. Answers come from `KnowledgeRecord`s built at runtime, ranked with [MiniSearch](https://lucaong.github.io/minisearch/), then formatted deterministically. Regex intents short-circuit common navigation/contact queries.

## Layout

| Path | Role |
| --- | --- |
| `index.ts` | `mountChatbot({ page: 'main' \| 'v4' })` — appends host + launcher (light entry chunk). |
| `launcher.ts` | Shadow-DOM FAB; dynamically imports `panel/panel` on open. |
| `panel/` | Chat UI; header Reset/Close expose `data-tooltip` labels (hover and focus-visible, theme tokens in `panel.css`); lazy-imports `engine` on first question. |
| `config.ts` | Copy, suggested questions, retrieval threshold, action URLs/labels. |
| `types.ts` | `KnowledgeRecord`, `Reply`, `ActionId`, `ChatEngine`. |
| `knowledge/buildRecords.ts` | Maps `src/data/*.ts` → records. |
| `knowledge/extras.json` | Optional FAQ / “not in CV” records merged in `knowledge/index.ts` (`getRecords`, `validateRecords`). |
| `engine/engine.ts` | `createEngine()` → `ask()`: intent → search → compose. |
| `engine/search.ts` | `createSearcher()` — sole MiniSearch import (kept off the critical path). |
| `engine/synonyms.ts` | Query/index normalization + `SYNONYMS`. |
| `engine/intents.ts` | Greeting, help, CV, email, LinkedIn, GitHub, projects. |
| `engine/compose.ts` | Hits → `Reply` text, sources, actions, follow-ups. |
| `engine/actions.ts` | Runs `CHATBOT_CONFIG.actions` in the browser. |

## Change CV content

Edit the typed modules under `src/data/` (`profile.ts`, `experience.ts`, `projects.ts`, `skills.ts`, `education.ts`). On the next build, `buildRecords()` regenerates profile, experience, project, skill, and education records (IDs, tags, and aliases derived from that data).

For extra copy not worth modeling in TS, append objects to `knowledge/extras.json` (see below).

## Add an FAQ or placeholder record

Add a JSON object to `knowledge/extras.json` (array). Each entry must match `KnowledgeRecord`:

- **`id`**: unique string (e.g. `faq-remote-work`).
- **`type`**: `faq` for normal answers; `unavailable` for “not in the CV” placeholders.
- **`title`**, **`text`**, **`source`**: shown/searched; `source` becomes the source chip label.
- **`tags`**: lowercase strings only (`validateRecords` enforces this).
- **`aliases`**: optional extra search phrases.
- **`available`**: `true` for FAQ; `false` for `unavailable` (still retrievable, with placeholder wording).

Duplicate IDs across `buildRecords()` and extras will fail validation/tests.

## Change config (URLs, labels, suggestions, threshold)

Edit `config.ts`:

- **`launcherSide`** — `'left'` (default) or `'right'`; mirrored onto the shadow host's `data-side`. Launcher, centered closed dock, desktop panel, and current greeting share this anchor with `max(16px, safe-area inset)` offsets. Vertical dock labels open inward; horizontal labels wrap above the row, anchored to its outer edge. Movement uses transforms, with reduced-motion overrides.

- **`CHATBOT_RETRIEVAL_THRESHOLD`** and **`CHATBOT_CONFIG.retrievalThreshold`** — minimum top-hit score (0–1) before compose returns “I don't have that in the CV.” (used in `compose.ts`).
- **`greeting`**, **`launcherBubbleText`** — panel and launcher copy.
- **`CHATBOT_KEYWORDS`** — typed `{ label, query }` pairs for Experience, Total Experience, Skills, Profile Summary, Projects, Education, Contact, and Download Resume. The welcome shows every label; reply follow-ups select at most four contextual labels and exclude the answered topic. Clicking sends the canonical full question, also displayed in the user bubble. Keep each query confidently answerable; `config.test.ts` checks every configured keyword.
- **`suggestedQuestions`** — default keyword labels for intent replies, derived from the first four keywords. Older stored sentence suggestions still render and send their original text unchanged.
- **`actions`** — one entry per `ActionId` (`cv`, `email`, `linkedin`, `github`, `projects`): `label`, `kind` (`open` \| `download` \| `mailto` \| `scroll`), `url`. CV/email/LinkedIn/GitHub pull from `src/data/profile.ts` where applicable.

## Add a synonym

Add a `key → canonical token` entry to `SYNONYMS` in `engine/synonyms.ts`. Multi-word keys are supported; category-style aliases (e.g. `work` → `experience`) are query-only and listed in `QUERY_ONLY_ALIASES` — do not rewrite index text for those. Tag tokens that should roll up under AWS queries can be added to `AWS_TERMS` in the same file.

## Tests

From the repo root:

```bash
npm test
```

Vitest covers knowledge building, search, engine/intents, compose behavior, golden questions, launcher, and panel helpers. Also run `npm run lint` and `npm run build` before shipping.

## Reply playback

`Reply.bubbles` contains ordered, self-contained messages; `text` is their `\n\n` join. Grounded composition targets at most five bubbles of at most 400 characters. Sources, actions, and suggestions retain their original content.

User messages appear immediately. The panel disables input during playback and shows an inline bot typing bubble before each message, source group, and action group, using the shared 100ms delay in `panel/messages.ts`. Suggestions appear together immediately after the final stage; each append scrolls the log to the bottom. Reset, Close, and Escape abort pending playback. Reduced motion and session-history restoration render instantly without timers; legacy history without `bubbles` uses `text` as one bubble.

Fake-timer tests cover staging boundaries, chip timing, cancellation, reduced motion, and legacy/current restore. Golden visitor questions verify the bubble/text join and multi-message replies where expected.

## Dock collision notes (static audit)

The desktop dock aligns with the panel's configured outer edge; its closed column is centered on the launcher. The dock uses inherited theme tokens with dark fallbacks for `/v4/`. The launcher wrapper's stacking context is 30, below the main navigation (50) and `/v4/` JSON modal (40), and above `/v4/` controls (20–25).

Width alone cannot guarantee separation: on short viewports the open dock can enter the top navigation or `/v4/` selector band. Short-height and compact layouts remain follow-up work; v4 customizer collision handling is out of scope. The greeting remains a bubble above the launcher, not a side tooltip. Geometry-based tests cover both sides and asymmetric safe areas; no browser or visual verification was performed.

## Optional embeddings reranker (not implemented)

Today ranking is entirely MiniSearch + synonym/entity logic in `search.ts`. To add a reranker later without changing the UI contract:

1. Keep `createSearcher()` returning `SearchHit[]` with `record` + `score`.
2. Insert a post-retrieval step in `engine.ts` (after `searcher.search`, before `composeReply`) that re-orders hits using embedding similarity, then maps the rerank score into 0–1 or blends it with the existing `score`.
3. Load the embedding model only inside that module (same lazy-import pattern as `panel` → `engine` → MiniSearch) so the launcher chunk stays small.

`ChatEngine.ask` can stay async; no server is required if you use a client-side model.