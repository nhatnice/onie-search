# facebook-internal

Out-of-tree Facebook private/internal scripts. **Not part of the portal feature code.**

## What lives here

Scripts that depend on Facebook private behavior (GraphQL schema, auth tokens, internal endpoints) that we cannot reasonably re-implement without an official API. Each file here is treated as a **third-party, opaque dependency** — the portal imports it by path, but does not own its maintenance.

| File                 | Source                                                                                                                               | Behavior                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reaction-export.js` | Originally from `facebook-crawl-reaction/` (third-party FB reaction exporter, copied from `Jemmia/android/facebook-crawl-reaction/`) | When injected into a Facebook page session via Playwright `page.addInitScript`, exposes a global `exportFBReactions(feedbackTargetID, opts)` that paginates reactors via FB's private GraphQL. Returns a list of `{uid, name, profileUrl, reactionType, ...}`. |

## Why is this separate?

1. **Not our code.** We do not maintain `reaction-export.js`. If it breaks, we have to either replace the script in full or fix it locally without committing the source-of-truth change back upstream.
2. **Fragile.** FB private endpoints + GraphQL schema change without notice. Each FB UI update is a potential silent break.
3. **Out of feature scope.** Features like `post-react` consume this script as an opaque dependency. Keeping it outside the feature folder signals "do not import this from anywhere else."

## Consumers

- `src/features/social/api/adapters/post-react/facebook.ts` — loads the script via `fs.readFileSync(absolutePath)` and injects it into the Playwright page via `page.addInitScript`.

## Maintenance

- **Break:** when `facebook.ts` fails with `exportFBReactions chưa load — injectReactionScript trước` or GraphQL errors, the issue is almost always in this script, not in our TS code.
- **Fix:** replace the file with an updated version from the upstream source, or swap to a different exporter.
- **Do not** import anything from this folder from feature code other than the established entry point (the `facebook.ts` consumer).

## Replacing this

The intended long-term replacement is to use FB's public Graph API where it supports reactions, or to scrape the reaction-likers UI via Playwright with a documented selector list. Both approaches are tracked as future work.
