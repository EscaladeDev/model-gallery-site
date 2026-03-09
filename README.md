# Escalade Model Gallery Site

GitHub Pages site for browsing, previewing, searching, and downloading 3D models from the Escalade model library.

## Live structure

This repo is a static site and is expected to publish a root `index.html`.

Current starter implementation includes:

- direct JSON-driven catalog loading from `data/manifest.json`
- featured model loading from `data/featured.json`
- live STL preview using three.js + STLLoader
- direct download links to raw files in `model-library-assets`
- source links to the asset repo

## Related repo

Asset source files live here:

`https://github.com/EscaladeDev/model-library-assets`

## Local testing

Because the site fetches local JSON files, test it through a local web server rather than opening `index.html` directly from the filesystem.

Examples:

```bash
python3 -m http.server
```

or use GitHub Pages.

## License

This repository and its contents are proprietary.
See `LICENSE.md`.
