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
