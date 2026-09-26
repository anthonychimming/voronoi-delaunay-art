# Voronoi & Delaunay — Generative Art Lab

Voronoi & Delaunay Art is an interactive generative art tool that transforms images into geometric compositions built from Voronoi cells and Delaunay triangulation, with adjustable styling, colour palettes, stroke treatment, and rendering controls for creating distinctive abstract, low-poly, and mosaic-like artwork.

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

## License

Voronoi & Delaunay Art is distributed under the **GNU General Public License v2.0 or later**. See **[LICENSE](LICENSE)**.
