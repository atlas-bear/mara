# MARA Documentation Site Startup Guide

This guide will help you get the MARA documentation site up and running after the redesign implementation.

## Quick Start

Follow these steps to start the documentation site:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Check for missing files**:
   ```bash
   node scripts/final-check.js
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. Open your browser to the local development server (typically http://localhost:3000/mara/)

## Troubleshooting Common Issues

### Missing Documentation Files

If you encounter error messages about missing documentation files (like in your initial attempt), you can use our automatic fix script:

```bash
node scripts/create-missing-docs.js
```

This will create placeholder files for any missing documentation referenced in the sidebar configuration.

### Plugin Installation Issues

If you encounter errors related to plugins, you may need to install them manually:

```bash
npm install --save @docusaurus/plugin-content-docs
```

We've simplified the plugin configuration to focus on essential functionality for the initial setup.

### Path Issues

If you see errors about incorrect paths or cannot find modules:

1. Make sure you're in the correct directory (`mara/docs`)
2. Try clearing the Docusaurus cache:
   ```bash
   npm run clear
   ```
3. Restart the development server

### Sidebar Configuration Issues

If you have trouble with the sidebar configuration, check:

1. That all referenced files exist (run `node scripts/final-check.js`)
2. That document IDs in frontmatter match the sidebar references
3. That the sidebar configuration files (`sidebars.js` and `sidebarsApi.js`) are valid

## Moving Forward

Once the site is running, you can:

1. **Customize the content**: Edit the Markdown files in the `docs/` and `api/` directories
2. **Adjust the styling**: Modify the CSS in `src/css/custom.css`
3. **Update the home page**: Edit `src/pages/index.js`
4. **Deploy to GitHub Pages**: Run `npm run deploy`

## Need More Help?

If you encounter issues not covered in this guide:

1. Check the `TROUBLESHOOTING.md` file for solutions to common problems
2. Review the `DEPLOYMENT.md` file for deployment instructions
3. Consult the `INSTALLATION.md` file for detailed setup instructions
4. Refer to the official [Docusaurus documentation](https://docusaurus.io/docs)

## Design Implementation

We've implemented a comprehensive design system based on the Field Notes aesthetic and Atlas Bear branding requirements:

- **Typography**: Josefin Sans for headings, Source Sans Pro for body text, and JetBrains Mono for code
- **Colors**: Warm earthy tones with muted accent colors
- **Layout**: Clean, readable layouts with appropriate spacing and hierarchy
- **Components**: Custom styled cards, code blocks, and UI elements
- **Dark Mode**: Full support with appropriate color adjustments

## Deployment

When you're ready to deploy to GitHub Pages:

```bash
npm run deploy
```

For more detailed deployment instructions, see `DEPLOYMENT.md`.
