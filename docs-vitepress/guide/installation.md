# MARA Installation Guide

This guide provides detailed instructions for setting up the MARA project from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18.0 or above)
- **npm** (usually comes with Node.js)
- **Git** (for version control)

## Step 1: Clone the Repository

Start by cloning the MARA repository from GitHub:

```bash
git clone https://github.com/atlas-bear/mara.git
cd mara
```

## Step 2: Install Dependencies

Install the required dependencies:

```bash
npm install
```

## Step 3: Set Up Environment Variables

Create a `.env` file in the root directory with the required environment variables:

```bash
# Create .env file
cp .env.example .env
```

Edit the `.env` file to include your specific API keys and configuration values:

```
# Airtable
AT_API_KEY=your_airtable_api_key
AT_BASE_ID_CSER=your_airtable_base_id

# Mapbox
VITE_MAPBOX_TOKEN=your_mapbox_token

# Claude AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# SendGrid (for email)
SENDGRID_API_KEY=your_sendgrid_api_key

# Netlify Blob Storage (for caching)
NETLIFY_BLOB_INSERT_URL=your_netlify_blob_insert_url
NETLIFY_BLOB_READ_URL=your_netlify_blob_read_url
```

## Step 4: Start the Development Server

### Run the Main MARA Application

```bash
npm run dev -- --filter @mara/app
```

This will start the development server for the main MARA application.

### Run the Client Application

```bash
npm run dev -- --filter @mara/client
```

This will start the development server for the white-labeled client application.

### Run All Applications

```bash
npm run dev
```

This will start development servers for all applications in the monorepo.

## Step 5: Test Netlify Functions Locally

To test the Netlify functions locally:

```bash
npm install -g netlify-cli
netlify dev
```

This will start a local Netlify development server that can execute serverless functions.

## Step 6: Documentation Development

To work on the documentation site:

```bash
cd docs-vitepress
npm install
npm run dev
```

This will start the VitePress development server for the documentation site.

## Troubleshooting

If you encounter any issues during installation:

1. **Dependency Issues**: Make sure you're using Node.js version 18.0+
   ```bash
   node --version
   ```

2. **Environment Variables**: Ensure all required environment variables are set correctly

3. **Port Conflicts**: If ports are already in use, you'll need to terminate the existing processes or configure different ports

4. **Netlify Functions**: For issues with Netlify functions, check the Netlify CLI documentation or try running specific functions directly:
   ```bash
   netlify functions:invoke function-name --no-identity
   ```

5. **Monorepo Issues**: If you encounter issues with the monorepo structure, try cleaning the Turborepo cache:
   ```bash
   npm run clean
   ```

## Additional Resources

- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Turborepo Documentation](https://turborepo.org/docs)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/api/)