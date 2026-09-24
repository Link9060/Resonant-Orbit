# ARROW stability repair — September 24, 2026

## Confirmed root causes

The shared shell observed every descendant DOM update. Its callback called mountAll, reapplied a saved theme, and rebuilt Appearance. That rebuild generated another observer delivery, starving input and rendering. The same mount path repeated arrival overlays before clearing the URL.

RAVIN popovers observed attributes that their own placement callback wrote, creating a frame-by-frame positioning loop. RAVIN bounded message queries sorted ascending before limiting, dropping recent context in long conversations.

## Repairs

- Observe shell mount additions/removals only, batch remounts per frame, and initialize saved themes only for new mounts.
- Update Appearance selection in place; preserve keyboard focus and expose pressed states.
- Avoid repeated host-theme attribute writes and guard duplicate script initialization.
- Handle each arrival and departure once.
- Return panel focus to the visible trigger; fit panel content inside short viewports and on-screen keyboards.
- Escape imported calendar date text, validate import list shapes before writing, and tolerate malformed stored settings lists.
- Reset accent and experience along with other preferences.
- Preserve fractional timer time; refresh completed timer controls; prevent a stale closing tab overwriting the shared timer.
- Preserve unfinished panel forms when unrelated settings change in another tab.
- Wire shared reduced-motion selection into Orbit, Atlas reveals, and Relay particles/transitions.
- Stop RAVIN popover positioning from observing its own style writes.
- Deduplicate RAVIN refresh requests; reject obsolete conversation responses; preserve sessions during transient startup errors.
- Load recent RAVIN messages in descending order with a limit, then reverse for display/model context; bound backend data request timeouts.
- Restore Atlas's sync label after a failed sync and retain an honest failure status.
- Refresh shared asset revisions in all four app entry points.

## Verification

- Shared-shell DOM tests cover all four module identities, each Appearance choice, observer stabilization, arrival deduplication, remounting, imported text, reset, and cross-tab draft preservation.
- The original shell fails eight of nine regression cases; the repaired shell passes all nine.
- RAVIN tests verify both bounded context queries and concurrent refresh/recovery behavior using mocked data, without touching user records.
- Orbit and Relay production exports, Atlas type/build/tests, and RAVIN JavaScript checks run locally.
- Publication uses existing branches: Orbit main, Atlas main, Relay beta, RAVIN deployment-prep.

## Limits

These checks do not certify every authenticated workflow or database policy. Backend query tests use synthetic fixtures. Render deployment status and authenticated end-to-end behavior require separate verification; do not infer them from a successful frontend deployment.
