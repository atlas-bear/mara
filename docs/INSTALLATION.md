# MARA Documentation Site Installation Guide

This guide provides detailed instructions for setting up the MARA documentation site from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18.0 or above)
- **npm** (usually comes with Node.js)
- **Git** (for version control and deployment)

## Step 1: Clone the Repository

Start by cloning the MARA repository from GitHub:

```bash
git clone https://github.com/atlas-bear/mara.git
cd mara
```

## Step 2: Set Up the Documentation Site

### Initialize the Setup

Run the setup script to create the necessary directory structure and files:

```bash
cd docs
node scripts/setup.js
```

### Install Dependencies

Install the required dependencies:

```bash
npm install
npm run install-deps
```

## Step 3: Configure the Site

The main configuration files are:

- **docusaurus.config.js**: Main configuration for the Docusaurus site
- **sidebars.js**: Configuration for the documentation sidebar
- **sidebarsApi.js**: Configuration for the API documentation sidebar

Review and modify these files as needed to fit your specific requirements.

## Step 4: Update Content

The documentation content is stored in the following directories:

- **docs/**: Main documentation content
- **api/**: API documentation content
- **blog/**: Blog/updates content

Update or add Markdown files to these directories to populate your site with content.

## Step 5: Customize the Design

The design system is implemented using:

- **src/css/custom.css**: Main CSS file with design variables and custom styling
- **src/css/fonts.css**: Font definitions and imports
- **src/components/design/**: Custom React components for the design system

Feel free to adjust these files to match your branding requirements.

## Step 6: Test Locally

Start the development server to view and test your site locally:

```bash
npm start
```

This will start a local server and open your browser to http://localhost:3000/mara/ (or a similar URL based on your configuration).

## Step 7: Build and Deploy

When you're ready to deploy:

1. Build the site:
   ```bash
   npm run build
   ```

2. Deploy to GitHub Pages:
   ```bash
   GIT_USER=<Your GitHub username> USE_SSH=true npm run deploy
   ```

   Alternatively, use the provided deployment script:
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

## Troubleshooting

If you encounter any issues during installation or deployment:

1. **Dependency Issues**: Make sure you're using the correct Node.js version (18.0+)
2. **Git Access Issues**: Ensure you have the proper permissions for the GitHub repository
3. **Build Errors**: Check the console output for specific error messages
4. **Style Not Applying**: Clear your browser cache or try a hard refresh

For more detailed troubleshooting, refer to the [Docusaurus documentation](https://docusaurus.io/docs) or open an issue in the GitHub repository.

## Additional Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Markdown Guide](https://www.markdownguide.org/)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
