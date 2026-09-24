# Resonant Orbit

Orbit is the central navigation world for the ARROW suite.

## Current prototype

- Relay-derived startup animation: central seed, expanding orbit rings, particle morph, and branded lockup.
- Relay-derived layered particle sphere renderer with pointer interaction.
- Orbit world layout with destinations for **Atlas**, **RAVIN**, **Relay**, and the future **W** module.
- The ARROW mark doubles as a small craft orbiting the central sphere.
- Destination selection updates a contextual inspector and pulses the particle field.
- Responsive desktop/mobile layout.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Direction

Orbit should feel less like a normal dashboard and more like a place: the sphere is the map, ARROW is the craft, and each product is a destination. Module handoffs are intentionally not wired yet; this first pass establishes the visual/navigation language before auth and cross-app routing are connected.
