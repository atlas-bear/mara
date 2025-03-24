# MARA Documentation with VitePress

This directory contains the documentation for the MARA (Maritime Risk Analysis) project using VitePress - a modern documentation framework built on Vite.

## Getting Started

To work with the documentation locally:

```bash
# Navigate to the docs directory
cd docs-vitepress

# Install dependencies 
npm install

# Start the development server
npm run docs:dev
```

Then open your browser to the URL shown in the terminal (typically http://localhost:5173/mara/).

## Directory Structure

- `.vitepress/` - VitePress configuration
  - `config.mjs` - Main configuration file
  - `.jsdoc.json` - JSDoc configuration for API documentation
- `api/` - Auto-generated API documentation (created during build)
- `guide/` - General guides and getting started information
- `data-pipeline/` - Data pipeline documentation
- `deduplication/` - Cross-source deduplication system documentation
- `flash-report/` - Flash Report system documentation
- `public/` - Static assets

## Writing Documentation

Documentation is written in Markdown format. The sidebar navigation is configured in `.vitepress/config.mjs`.

## Building and Deployment

The documentation is automatically built and deployed to GitHub Pages when changes are pushed to the main branch, using GitHub Actions.

To build the documentation manually:

```bash
npm run docs:build
```

To preview the built site:

```bash
npm run docs:preview
```

## JSDoc Integration

API documentation is automatically generated from JSDoc comments in the source code. To update the API documentation:

1. Add or update JSDoc comments in the source code
2. The documentation will be regenerated during the build process