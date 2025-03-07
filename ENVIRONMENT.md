# Environment Variables Usage Guide

This document explains how environment variables should be used in the MARA application.

## Server-side vs Client-side Environment Variables

MARA uses different approaches for accessing environment variables depending on whether the code is running server-side (in Netlify Functions) or client-side (in the browser).

### Server-side Environment Variables (Netlify Functions)

In server-side code (Netlify Functions located in the `/functions` directory), use `process.env` directly:

```javascript
// CORRECT: Server-side environment variable access
const apiKey = process.env.SENDGRID_API_KEY;
const mapboxToken = process.env.MAPBOX_TOKEN;
```

**IMPORTANT**: Never use `VITE_` prefixed variables in server-side code, as these are strictly for client-side use.

```javascript
// INCORRECT: Don't use import.meta.env in server-side code
const apiKey = import.meta.env.VITE_SENDGRID_API_KEY; // This will not work!

// INCORRECT: Don't use VITE_ prefixed variables with process.env
const mapboxToken = process.env.VITE_MAPBOX_TOKEN; // This will not work!
```

### Client-side Environment Variables (Browser)

In client-side code (React components, browser-side services), use `import.meta.env` to access Vite-injected environment variables:

```javascript
// CORRECT: Client-side environment variable access
const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
const clientLogo = import.meta.env.VITE_CLIENT_LOGO;
```

**IMPORTANT**: All client-side environment variables must be prefixed with `VITE_` to be accessible.

## Required Environment Variables

### Server-side (Netlify Functions)

| Variable | Purpose |
|----------|---------|
| `MAPBOX_TOKEN` | MapBox API token for generating static maps |
| `SENDGRID_API_KEY` | SendGrid API key for sending emails |
| `SENDGRID_FROM_EMAIL` | Email address to use as the sender |
| `AIRTABLE_API_KEY` | Airtable API key for accessing incident data |
| `AIRTABLE_BASE_ID` | Airtable base ID containing incident records |

### Client-side (Browser)

| Variable | Purpose |
|----------|---------|
| `VITE_MAPBOX_TOKEN` | MapBox API token for interactive maps |
| `VITE_CLIENT_NAME` | Client company name for branding |
| `VITE_CLIENT_LOGO` | URL to client logo for branding |

## Setting Environment Variables

### Local Development

Create a `.env` file in the project root with all required variables:

```
# Server-side (no VITE_ prefix)
MAPBOX_TOKEN=pk.eyJ1...
SENDGRID_API_KEY=SG.xxxxxxx
SENDGRID_FROM_EMAIL=alerts@example.com
AIRTABLE_API_KEY=key...
AIRTABLE_BASE_ID=app...

# Client-side (with VITE_ prefix)
VITE_MAPBOX_TOKEN=pk.eyJ1...
VITE_CLIENT_NAME=Example Client
VITE_CLIENT_LOGO=https://example.com/logo.png
```

### Netlify Deployment

Set environment variables in the Netlify dashboard:
1. Go to Site settings > Build & deploy > Environment
2. Add all required variables
3. Redeploy the site for changes to take effect

**Note**: For development with Netlify CLI, use a `.env` file that contains all variables.