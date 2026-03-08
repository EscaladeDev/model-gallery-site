# Escalade Model Gallery Site

GitHub Pages site for browsing, previewing, searching, and downloading 3D models from the Escalade model library.

This repository contains the front-end website and generated catalog data for the public gallery. The site presents 3D models in a premium-style searchable interface and links downloads to release assets hosted in the companion asset repository:

`https://github.com/EscaladeDev/model-library-assets`

## Purpose

This repository powers the public model catalog experience.

It is responsible for:

- rendering the gallery UI
- loading generated model metadata
- searching and filtering models by tags
- displaying thumbnails or live preview fallbacks
- showing featured content such as **Model of the Month**
- linking models to downloadable GitHub Release assets

## Related Repository

Model files and downloadable release assets are stored in:

`https://github.com/EscaladeDev/model-library-assets`

This split keeps the website lightweight while allowing model downloads to be distributed through GitHub Releases.

## Features

- Static site deployment through GitHub Pages
- Search and tag-based filtering
- Automatic tag extraction from filenames
  - Example: `human-guard.stl` → `human`, `guard`
- Responsive premium gallery layout
- Thumbnail-first preview system
- Live 3D preview fallback when no thumbnail exists
- Dedicated model detail pages
- Featured spotlight support
- Manifest-driven catalog architecture for efficient loading

## How It Works

The site does **not** browse raw GitHub folders live in the browser.

Instead, it reads generated catalog files such as `manifest.json` and uses those to render the site quickly and consistently.

### Content flow

1. Model files are added to the asset repository
2. Downloadable files are attached to GitHub Releases in the asset repository
3. Catalog data is generated for the site
4. GitHub Pages serves the static front end

## Repository Structure

```text
src/                  Front-end source
public/               Static public assets
public/data/          Generated catalog data
public/thumbnails/    Preview thumbnails
scripts/              Manifest/build helper scripts
content/featured/     Featured content and spotlight data
.github/workflows/    Build and deployment workflows
