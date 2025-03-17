# MARA Documentation Site

This directory contains the MARA documentation site, built with [Docusaurus 3](https://docusaurus.io/). The site features a clean, professional design inspired by the Atlas Bear brand and Field Notes aesthetic.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) version 18.0 or above
- [Git](https://git-scm.com/downloads) for deployment to GitHub Pages

### Installation

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/atlas-bear/mara.git
cd mara/docs

# Install dependencies
npm install
```

### Local Development

```bash
# Start the development server
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
# Build the website
npm run build
```

This command generates static content into the `build` directory that can be served by any static content hosting service.

### Deployment

The site is configured to deploy to GitHub Pages. You can deploy using the following command:

```bash
# Deploy to GitHub Pages
GIT_USER=<Your GitHub username> USE_SSH=true npm run deploy
```

Alternatively, you can use the deployment script:

```bash
# Make the script executable first
chmod +x scripts/deploy.sh

# Run the deployment script
./scripts/deploy.sh
```

## Project Structure

- **blog/**: Contains blog/updates articles
- **docs/**: Contains documentation content in Markdown
- **src/**: Source code of the website
  - **components/**: React components
  - **css/**: CSS files
  - **pages/**: Special pages (like the home page)
- **static/**: Static assets like images
- **docusaurus.config.js**: Configuration file for Docusaurus
- **sidebars.js**: Sidebar configuration for documentation

## Design Elements

The design follows these principles:

- **Typography**:
  - Headers: Josefin Sans (bold and distinctive)
  - Body Text: Source Sans Pro (for readability)
  - Code: JetBrains Mono (clean developer experience)

- **Color Scheme**:
  - Neutral base with muted, professional palette
  - Inspired by Field Notes aesthetics (warm earthy tones, soft blues)
  - Subtle paper texture for background

- **Layout**:
  - Clean navigation
  - Generous white space
  - Well-structured content hierarchy

## Contributing

Please refer to the [CONTRIBUTING.md](../CONTRIBUTING.md) file in the root directory of this repository for contribution guidelines.

## License

This project is licensed under the terms specified in the [LICENSE](../LICENSE) file in the root of this repository.
