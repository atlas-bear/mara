# Getting Started with MARA

This guide will help you set up the MARA project for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or later)
- **npm** (v7 or later)
- **Git**

## Installation

1. Clone the repository:

```bash
git clone https://github.com/atlas-bear/mara.git
cd mara
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory with the following variables:

```
AT_API_KEY=your_airtable_api_key
AT_BASE_ID_CSER=your_airtable_base_id
ANTHROPIC_API_KEY=your_anthropic_api_key
MAPBOX_TOKEN=your_mapbox_token
PUBLIC_URL=http://localhost:8888
```

## Development

### Running the Application

To run the main MARA application:

```bash
npm run dev -- --filter @mara/app
```

### Running Netlify Functions Locally

To run Netlify functions locally:

```bash
npm run netlify:dev
```

This will start a local server and allow you to test Netlify functions.

### Testing Specific Components

#### Data Collection

To test data collection functions:

```bash
npm run netlify:dev
curl http://localhost:8888/.netlify/functions/collect-recaap
```

#### Deduplication

To test deduplication with dry run mode:

```bash
npm run netlify:dev
curl http://localhost:8888/.netlify/functions/deduplicate-cross-source-background?dryRun=true
```

#### Data Processing

To test data processing:

```bash
npm run netlify:dev
curl http://localhost:8888/.netlify/functions/process-raw-data-background
```

## Project Structure

The MARA project is organized as follows:

- **/src**: Contains the front-end applications
  - **/apps/mara**: Main MARA application
  - **/shared**: Shared components and utilities
- **/functions**: Netlify serverless functions
  - Collection functions (collect-*.js)
  - Processing functions (process-*.js)
  - Deduplication system (deduplicate-*.js)
  - Flash Report system (send-flash-report.js)
- **/docs-vitepress**: This documentation

## Next Steps

- Read the [Architecture Guide](/guide/architecture) to understand MARA's technical architecture
- Explore the [Data Pipeline](/data-pipeline/) to learn about data collection and processing
- Learn about the [Cross-Source Deduplication System](/deduplication/)
- Check out the [Flash Report System](/flash-report/) documentation