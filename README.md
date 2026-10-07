# Resonant Orbit

Orbit is the central navigation world for the ARROW suite.

## Current prototype

- Relay-derived startup animation: central seed, expanding orbit rings, particle morph, and branded lockup.
- Relay-derived layered particle sphere renderer with pointer interaction.
- Orbit world layout with connected destinations for **Atlas**, **RAVIN**, **Relay**, and **Waypoint**.
- The ARROW mark doubles as a small craft orbiting the central sphere.
- Destination selection updates a contextual inspector, live ARROW status, semantic Navigator aliases, and animated travel.
- Responsive desktop/mobile layout.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Direction

Orbit should feel less like a normal dashboard and more like a place: the sphere is the map, ARROW is the craft, and each product is a destination. Atlas, RAVIN, Relay, and Waypoint are wired as live routes. Shared browser data is visible across ARROW centers; account-level cloud sync remains a separate backend milestone.


## ARROW beta review — October 6, 2026

ARROW’s shared account supports username/password registration without email or phone. Usernames use 3–20 letters, digits or underscores; new passwords require at least 12 characters. Recovery email can be linked and verified from Relay Profile → Sign-in and recovery; phone linking is offered only when SMS Auth is enabled. Existing Google and email sign-in remain available. New accounts still follow the existing beta approval policy.

The ARROW bar → Settings links to profile, notification device registration and setup, layout and particle preferences, privacy, terms, account export/deletion, and the setup guide. Appearance supports system/light/dark, reduced motion and custom accent color. Device preferences are separate from cloud account planning data.

Phone sign-in is currently blocked by `external.phone=false` in Supabase Auth. The UI detects that and explains the available alternatives. Enabling real SMS delivery requires a configured provider; code alone does not enable it.

This review also repairs shared panel Escape handling, failed task/event writes, stale panel responses, notification/help discoverability, light-theme surfaces and accent propagation. The 200 additional corrections listed in Relay’s `docs/arrow-ui-200.md` are individual small-text readability corrections, not 200 independent functionality bugs.
