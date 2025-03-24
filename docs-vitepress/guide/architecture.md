# MARA Project Architecture

## Project Overview

MARA (Multi-source Analysis and Reporting Architecture) is a monorepo project consisting of multiple applications that share common functionality. The project follows a modern JavaScript architecture using React, Vite, Tailwind CSS, and Netlify for deployment.

## Repository Structure

```
mara/
├── .git/                      # Git repository metadata
├── .netlify/                  # Netlify configuration and cache
├── data/                      # Data files and resources
├── docs-vitepress/            # Project documentation (VitePress)
├── functions/                 # Netlify serverless functions for the main app
├── scripts/                   # Utility scripts for the project
├── src/
│   ├── apps/                  # Contains individual applications
│   │   ├── mara/              # Main MARA application
│   │   │   ├── components/    # App-specific components
│   │   │   ├── config/        # Configuration files
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── layouts/       # Layout components
│   │   │   ├── routes/        # Route components
│   │   │   └── utils/         # Utility functions
│   │   └── client/            # White-labeled client application
│   │       ├── functions/     # Client-specific Netlify functions
│   │       ├── src/           # Client app source code
│   │       └── netlify.toml   # Client-specific Netlify configuration
│   └── shared/                # Shared components and utilities
│       ├── components/        # Common UI components used across apps
│       │   └── MaritimeMap/   # Shared map component
│       └── features/          # Feature modules that encapsulate business logic and UI
│           └── weekly-report/ # Weekly report feature module
│               ├── components/# Feature-specific components
│               ├── utils/     # Feature-specific utilities
│               └── index.js   # Public exports for the feature
├── .env                       # Environment variables (not committed)
├── .gitignore                 # Git ignore configuration
├── netlify.toml               # Main Netlify configuration
├── package.json               # Root package.json for workspace management
└── turbo.json                 # Turborepo configuration
```

## Technology Stack

- **Frontend Framework**: React with functional components and hooks
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS for utility-first styling
- **Package Management**: NPM Workspaces for monorepo organization
- **Build Orchestration**: Turborepo for efficient builds across packages
- **Deployment**: Netlify for both apps and serverless functions
- **Maps**: Mapbox GL JS for interactive maps
- **Charts**: Recharts for data visualization
- **Networking**: Axios for API calls
- **Data Sources**: Airtable as the backend database
- **AI Integration**: Claude for intelligent data analysis

## Applications

### MARA Application

The main MARA application is the central intelligence platform that includes:

- Flash reporting capabilities
- Weekly maritime security reports
- Incident tracking and analysis
- Interactive mapping
- Data visualization

**Key Components**:

- Incident visualization and management
- Flash report generation
- Weekly reporting tools
- Geospatial analysis

**Main Routes**:

**Weekly Report (/weekly-report/:yearWeek)**

- Comprehensive weekly analysis of maritime security incidents
- Regional breakdowns with threat assessments
- Interactive incident map
- Trend analysis and historical data

**Flash Report (/flash-report/:incidentId)**

- Immediate incident notifications
- Email alerts via Novu integration
- Detailed incident analysis
- Interactive incident location mapping

**Entry Point**: `src/apps/mara/main.jsx`

### Client Application

The client application is a white-labeled version that provides specific functionality to client organizations:

- Focused on weekly maritime security reports
- Client-branded interface
- Simplified feature set
- Custom Netlify functions

**Key Components**:

- Weekly reporting interface
- Client-specific styling
- Restricted feature set

**Main Routes**:

**Weekly Report (/:yearWeek)**

- White-labeled version of the weekly maritime security report
- Client-branded interface
- Regional incident analysis and mapping
- Focused feature set for client needs

**Entry Point**: `src/apps/client/src/main.jsx`

## Data Processing Pipeline

MARA employs a sophisticated data processing pipeline to transform raw incident data from various sources into coherent, deduplicated incident records:

1. **Data Collection**: Scheduled functions collect data from various maritime sources (RECAAP, UKMTO, MDAT, ICC)
2. **Deduplication**: The cross-source deduplication system identifies and merges duplicate reports
3. **Processing**: Raw data is processed to standardize formats and extract key information
4. **Incident Creation**: Processed data is used to create comprehensive incident records
5. **Reporting**: Incidents are analyzed and compiled into Flash Reports and Weekly Reports

For detailed information about the data pipeline, see the [Data Pipeline documentation](/data-pipeline/).

## Functions Configuration

Netlify Functions require specific configuration in the `netlify.toml` file:

```toml
[functions]
directory = "functions"
node_bundler = "esbuild"

# Scheduled functions
[functions."collect-recaap"]
schedule = "0,30 * * * *"

[functions."process-incidents"]
schedule = "25,55 * * * *"

[functions."deduplicate-cross-source-background"]
schedule = "28 * * * *"
background = true
```

This configuration:

- Specifies the directory containing function code
- Uses esbuild for bundling Node.js functions, which handles dependencies more effectively
- Schedules several types of functions to run at specified intervals:
  - Data collection functions to fetch from maritime sources
  - Deduplication function to identify and merge duplicate reports
  - Processing function to transform raw data into incident records

## Environment Configuration

Each application requires specific environment variables:

### MARA App

- `VITE_MAPBOX_TOKEN`: Mapbox GL token for map rendering
- `AT_BASE_ID_CSER`: Airtable base ID for CSER database
- `AT_API_KEY`: Airtable API key
- `ANTHROPIC_API_KEY`: Claude API key for AI analysis
- `PUBLIC_URL`: Public URL for the application

### Client App

- `VITE_MAPBOX_TOKEN`: Mapbox GL token
- `AT_BASE_ID_CSER`: Airtable base ID
- `AT_API_KEY`: Airtable API key
- `VITE_CLIENT_NAME`: Client name for branding
- `VITE_CLIENT_PRIMARY_COLOR`: Brand primary color
- `VITE_CLIENT_SECONDARY_COLOR`: Brand secondary color
- `VITE_CLIENT_LOGO`: Client logo URL

## Development Workflow

1. Run the dev server for a specific app using Turbo:

   ```
   npm run dev -- --filter @mara/app
   # or
   npm run dev -- --filter @mara/client
   ```

2. Use Netlify Dev for local function testing:
   ```
   cd src/apps/client
   netlify dev
   ```

## Monorepo Management

The project uses NPM Workspaces and Turborepo for monorepo management:

- **NPM Workspaces**: Defined in the root package.json to organize packages
- **Turborepo**: Configured in turbo.json for optimized builds and dependency management

```json
// Root package.json workspaces configuration
{
  "workspaces": ["src/apps/*", "src/shared"]
}
```