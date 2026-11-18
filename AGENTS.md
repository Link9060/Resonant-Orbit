<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ARROW integrated beta target: read before editing

**The standalone Orbit site is NOT the user's integrated ARROW Beta.**

Integrated beta URL: https://link9060.github.io/Resonant-Relay/arrow/orbit/

Source of truth is `Link9060/Resonant-Relay` base branch `beta`. Read its root `AGENTS.md`, `relay/scripts/build-arrow-beta.mjs`, and `relay/scripts/arrow-beta-centers.json`.

To fix the integrated beta Orbit:
1. Retrieve the exact `Resonant-Orbit` SHA pinned in that JSON.
2. Branch **from that SHA**, not default Orbit `main`.
3. Make and test fixes on a review branch.
4. Update the pin in a separate **Relay beta-targeted PR**. Until that integration PR is merged and deployed, the beta is unchanged.
5. Preserve full vs Relay-only access, custom quick locations, 1–4 shortcuts, account sync, and the user's existing UI.
6. Never merge or deploy without explicit owner approval.

A standalone Orbit PR or a standalone CI pass is NOT evidence that the integrated ARROW Beta was fixed. Report source, exact commit SHA, test results and deployment status accurately.
