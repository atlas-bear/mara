# MARA Documentation Site Deployment Guide

This guide provides detailed instructions for setting up, developing, and deploying the MARA documentation site.

## Initial Setup

### 1. Requirements

Ensure you have the following installed:

- **Node.js** (version 18.0 or above)
- **npm** (usually comes with Node.js)
- **Git** (for version control and deployment)

### 2. Clone the Repository

If you haven't already, clone the MARA repository:

```bash
git clone https://github.com/atlas-bear/mara.git
cd mara/docs
```

### 3. Install Dependencies

Install the required dependencies:

```bash
npm install
```

Alternatively, you can use the provided script:

```bash
chmod +x scripts/install-deps.sh
./scripts/install-deps.sh
```

## Local Development

### Starting the Development Server

To start the local development server:

```bash
npm start
```

This will start the development server and open your default browser to the local site (typically at http://localhost:3000/mara/).

### Building for Production

To build the site for production:

```bash
npm run build
```

This generates the static files in the `build` directory.

To test the production build locally:

```bash
npm run serve
```

## Deployment to GitHub Pages

The MARA documentation site is configured to be hosted on GitHub Pages.

### Using the Deployment Script

The simplest way to deploy is using the provided script:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This script will build the site and deploy it to GitHub Pages.

### Manual Deployment

If you prefer to deploy manually:

1. Build the site:
   ```bash
   npm run build
   ```

2. Deploy to GitHub Pages:
   ```bash
   GIT_USER=<Your GitHub username> USE_SSH=true npm run deploy
   ```

   If you prefer HTTPS authentication:
   ```bash
   GIT_USER=<Your GitHub username> npm run deploy
   ```

### Deployment Configuration

The deployment configuration is specified in `docusaurus.config.js`:

```javascript
{
  url: 'https://atlas-bear.github.io',
  baseUrl: '/mara/',
  organizationName: 'atlas-bear',
  projectName: 'mara',
  trailingSlash: false,
}
```

Make sure these settings match your GitHub repository details.

## Customizing the Site

### Updating Content

- **Documentation**: Edit or add Markdown files in the `docs` directory
- **Blog/Updates**: Edit or add Markdown files in the `blog` directory
- **Home Page**: Edit the React component in `src/pages/index.js`

### Modifying the Design

- **CSS**: Update styles in `src/css/custom.css`
- **Theme**: Adjust colors, fonts, and other theme settings in `docusaurus.config.js`
- **Components**: Modify React components in the `src/components` directory

### Adding New Dependencies

If you need to add new dependencies:

```bash
npm install --save package-name
```

## Troubleshooting

### Common Issues

1. **Deployment Fails**:
   - Ensure you have the correct permissions for the GitHub repository
   - Verify your SSH keys are set up if using SSH authentication
   - Check that the repository settings allow GitHub Pages deployment

2. **Broken Links**:
   - Run `npm run build` to check for broken links before deployment
   - Ensure all internal links use relative paths

3. **CSS Not Updating**:
   - Try clearing your browser cache
   - Restart the development server

4. **Images Not Loading**:
   - Ensure images are in the `static/img` directory
   - Use the correct path: `/img/your-image.png`

### Getting Help

If you encounter issues not covered in this guide, please:

1. Check the [Docusaurus documentation](https://docusaurus.io/docs)
2. Open an issue in the [MARA repository](https://github.com/atlas-bear/mara/issues)
3. Reach out to the development team on the internal communication channels

## Maintenance

### Updating Docusaurus

To update Docusaurus to the latest version:

```bash
npm update @docusaurus/core @docusaurus/preset-classic
```

### Regular Tasks

- Keep dependencies updated
- Regularly review and update content for accuracy
- Monitor site performance and optimize as needed
- Ensure the site meets accessibility standards
