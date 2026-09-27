# Voronoi & Delaunay — Generative Art Lab

Voronoi & Delaunay Art is an interactive generative art tool that transforms images into geometric compositions built from Voronoi cells and Delaunay triangulation, with adjustable styling, colour palettes, stroke treatment, and rendering controls for creating distinctive abstract, low-poly, and mosaic-like artwork.

**[▶ Launch Voronoi & Delaunay — Generative Art Lab](https://anthonychimming.github.io/voronoi-delaunay-art/)**

## Structure

```text
voronoi-delaunay-art-dev/
├─ index.html
├─ css/
│  └─ styles.css
└─ js/
   ├─ utils.js       # DOM helper, seeded PRNG, Simplex noise
   ├─ geometry.js    # Delaunay + Voronoi geometry and centroids
   ├─ palettes.js    # Palette definitions and preview UI
   ├─ render.js      # Canvas rendering, SVG/PNG export, rendering helpers
   └─ app.js         # UI bindings and application startup
```

## Run

You can open `index.html` directly in a browser. For normal development, a local server is preferable so browser dev tools and future module/assets changes behave predictably.

Examples:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Implementation notes

Geometry preserves the existing order: seeded random sites → noise warp → Lloyd relaxation. Moving warp after Lloyd changes established seeded artwork, so the original order is retained even though relaxation can soften the warp.

Traditional scripts and their explicit loading order remain in place. An ES module conversion is deferred because it would expand this targeted remediation and change direct `index.html` usage. No framework, dependencies, or build step are required by the application.

Preview scaling fits the available space without enlarging beyond the Canvas backing resolution. PNG dimensions and the SVG viewBox still use the selected aspect ratio's backing size.

Hatching uses each cell's bounding-box diagonal to limit line coverage. Canvas and SVG share that coverage, with the existing angles, spacing, and phase preserved. The shorter vector paths omit off-cell lines; cells whose rotated corners previously lacked coverage now hatch fully.

The Canvas exposes artwork details to assistive technology. A separate polite status announces completed control changes, while slider `input` events remain quiet. Custom color fields retain their existing keyboard controls and explain the accepted hex format.

## Checks

Serve the app at `http://127.0.0.1:8765` and run these scripts with Playwright and Chrome available in your development environment:

```bash
node tests/custom-palette.cjs
node tests/rendering.cjs
node tests/performance.cjs
node tests/stability.cjs
```

These development checks are optional tooling; the application itself remains dependency-free. They cover palettes and exports, geometry/rendering edge cases, cache and scheduling behavior, hatch coverage, preview sizing, and keyboard/assistive-technology semantics.

## License

Voronoi & Delaunay Art is distributed under the **GNU General Public License v2.0 or later**. See **[LICENSE](LICENSE)**.
