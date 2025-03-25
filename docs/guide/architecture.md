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
- **Email Delivery**: SendGrid for email notifications
- **Cache Storage**: Netlify Blob Storage for caching
- **Authentication**: JWT-based token system

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
- Email alerts via SendGrid integration
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

## Shared Architecture

### Components

Shared components are stored in `src/shared/components` and include basic UI elements that are used across applications:

- `MaritimeMap`: Interactive map component for displaying maritime incidents
- `PDFDownloadButton`: Browser-based PDF generation for reports
- Other UI components as needed

### Features

Feature modules in `src/shared/features` encapsulate complete features that can be imported by any application:

- `weekly-report/`: Weekly report generation and display
  - Components for different sections of the report (ExecutiveBrief, RegionalBrief, IncidentDetails)
  - Utilities for date handling and data fetching
  - API integration

Each feature module follows this structure:

```
feature-name/
├── components/     # React components specific to this feature
├── utils/          # Utility functions for this feature
└── index.js        # Public API exports
```

## Data Flow

1. **API Layer**: Netlify functions act as a secure API layer
2. **Data Fetching**: Client-side data fetching using Axios
3. **State Management**: React useState and useEffect for component state
4. **Shared Logic**: Common business logic in shared utilities
5. **Rendering**: Component rendering with data passed via props

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

[functions."get-weekly-report-content-background"]
schedule = "0 21 * * 1"
background = true
```

This configuration:

- Specifies the directory containing function code
- Uses esbuild for bundling Node.js functions, which handles dependencies more effectively
- Schedules several types of functions to run at specified intervals:
  - Data collection functions to fetch from maritime sources
  - Deduplication function to identify and merge duplicate reports
  - Processing function to transform raw data into incident records
  - Weekly report generation function to run at 21:00 UTC on Mondays

### Function Dependencies

Each function can have its own package.json to manage dependencies:

```
functions/
└── get-weekly-incidents/
    ├── index.js
    └── package.json  # Optional but recommended for dependency management
```

## Environment Configuration

Each application requires specific environment variables:

### MARA App

- `VITE_MAPBOX_TOKEN`: Mapbox GL token for map rendering
- `AT_BASE_ID_CSER`: Airtable base ID for CSER database
- `AT_API_KEY`: Airtable API key
- `ANTHROPIC_API_KEY`: Claude API key for AI analysis
- `PUBLIC_URL`: Public URL for the application
- `SENDGRID_API_KEY`: SendGrid API key for email delivery
- `NETLIFY_BLOB_INSERT_URL`: URL for Netlify Blob Storage insert operations
- `NETLIFY_BLOB_READ_URL`: URL for Netlify Blob Storage read operations

### Client App

- `VITE_MAPBOX_TOKEN`: Mapbox GL token
- `AT_BASE_ID_CSER`: Airtable base ID
- `AT_API_KEY`: Airtable API key
- `VITE_CLIENT_NAME`: Client name for branding
- `VITE_CLIENT_PRIMARY_COLOR`: Brand primary color
- `VITE_CLIENT_SECONDARY_COLOR`: Brand secondary color
- `VITE_CLIENT_LOGO`: Client logo URL

## Build and Deployment

### Development Workflow

1. Run the dev server for a specific app using Turbo:

   ```
   npm run dev -- --filter @mara/app
   # or
   npm run dev -- --filter @mara/client
   ```

2. Use Netlify Dev for local function testing:
   ```
   netlify dev
   ```

### Production Builds

- Each application has its own Netlify site
- Builds are triggered by commits to the main branch
- Environment variables are managed in Netlify's UI
- Functions are deployed alongside the application

## Adding a New White-Label Client

To create a new white-labeled instance for another client:

1. Clone the client app template:

   ```
   cp -r src/apps/client src/apps/new-client
   ```

2. Update package.json with a new name:

   ```json
   {
     "name": "@mara/new-client",
     ...
   }
   ```

3. Configure environment variables for the new client

4. Set up a new Netlify site for deployment

5. Customize branding elements as needed

## Common Issues and Troubleshooting

### Styling Issues

If components appear unstyled, ensure that Tailwind is configured correctly to scan shared components:

```js
// In tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "../../shared/**/*.{js,ts,jsx,tsx}",
  ],
  // ...
};
```

### Function Deployment

For Netlify Functions, make sure:

1. The netlify.toml has the proper functions configuration:

   ```toml
   [functions]
   directory = "functions"
   node_bundler = "esbuild"
   ```

2. Dependencies are correctly installed. While not strictly required with esbuild bundling, including a package.json in the functions directory can help manage dependencies explicitly.

### Environment Variables

Ensure environment variables are correctly set in:

- `.env` for local development
- Netlify UI for production deployment

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

## Future Architecture Considerations

1. **State Management**: For more complex state, consider implementing Redux or Context API
2. **API Layer**: Expand the API abstraction to handle more complex operations
3. **Testing**: Add Jest and React Testing Library for component testing
4. **CI/CD**: Enhance the build pipeline with automated testing
5. **TypeScript**: Consider migrating to TypeScript for improved type safety