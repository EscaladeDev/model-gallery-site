# Escalade Model Gallery Site

A premium-style static 3D model catalog built for GitHub Pages.

This site displays a searchable library of 3D models, extracts tags from filenames, shows thumbnails or live previews, and links each model to downloadable release assets hosted through GitHub Releases.

## Features

- Fast static site deployment on GitHub Pages
- Search and filter models by tags
- Tags automatically extracted from filenames
  - Example: `human-guard.stl` → `human`, `guard`
- Premium gallery layout with responsive cards
- Thumbnail-first preview system
- Automatic fallback to live 3D preview when no thumbnail exists
- Dedicated model detail pages
- “Model of the Month” / featured spotlight support
- Manifest-driven architecture for efficient loading at scale
- Download delivery via GitHub Releases

## How It Works

This repo contains the front-end site and generated catalog data.

The site does **not** browse raw repository folders live in the browser. Instead, it reads generated metadata files such as `manifest.json` and uses those to render the catalog quickly and consistently.

### Content flow

1. Model files are stored and released from the asset repo
2. Release asset URLs are resolved into catalog data
3. A generated manifest is built for the site
4. GitHub Pages serves the static front end

## Repo Structure

```text
src/                  Front-end source
public/               Static public assets
public/data/          Generated catalog data
public/thumbnails/    Preview thumbnails
scripts/              Manifest/build helper scripts
content/featured/     Featured and spotlight content
.github/workflows/    Build and deployment workflows
