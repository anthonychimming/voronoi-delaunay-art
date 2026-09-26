# Voronoi & Delaunay — Generative Art Lab

Development split of the original standalone HTML app. No build step or external dependencies are required.

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

## Notes

- Behavior and control IDs are preserved from the standalone version.
- Scripts remain classic ordered scripts rather than ES modules, so the split does not require a bundler or import/export refactor.
- The file order in `index.html` is significant because later files use functions/constants declared earlier.
