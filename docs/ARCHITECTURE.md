# MARA Technical Architecture

## Application Structure

```
src/apps/mara/
├── components/
│   ├── WeeklyReport/       # Weekly report components
│   │   ├── ExecutiveBrief/
│   │   ├── IncidentDetails/
│   │   └── RegionalBrief/
│   ├── FlashReport/        # Flash report components
│   │   ├── EmailTemplate/
│   │   └── PreviewMode/
│   └── shared/             # Shared components
│       └── MaritimeMap/
├── routes/
│   ├── weekly/            # Weekly report routes
│   │   └── WeeklyReportPage.jsx
│   └── flash/             # Flash report routes
│       └── FlashReportPage.jsx
├── services/
│   └── notifications/     # Notification services
│       ├── novu.js
│       └── templates.js
├── utils/
│   ├── airtable.js
│   ├── api.js
│   ├── coordinates.js
│   ├── dates.js
│   └── trend-api.js
├── App.jsx                # Main application router
├── index.html
├── main.jsx
└── index.css

```

## Key Features

### Weekly Report (/weekly-report/:yearWeek)
- Comprehensive weekly analysis of maritime security incidents
- Regional breakdowns with threat assessments
- Interactive incident map
- Trend analysis and historical data

### Flash Report (/flash-report/:incidentId)
- Immediate incident notifications
- Email alerts via Novu integration
- Detailed incident analysis
- Interactive incident location mapping

## Technology Stack

- **Frontend Framework**: React
- **Router**: React Router
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL
- **Charts**: Recharts
- **Notifications**: Novu
- **Build Tool**: Vite
- **Deployment**: Netlify

## Routing Structure

The application uses React Router for client-side routing:

- `/weekly-report/:yearWeek`
  - Displays weekly maritime security report
  - Example: `/weekly-report/2025-06`

- `/flash-report/:incidentId`
  - Displays individual incident reports
  - Example: `/flash-report/2024-2662`

## Development

### Local Development
```bash
# Start development server with Netlify Functions
netlify dev

# Access the application
Weekly Report: http://localhost:8888/weekly-report/2025-06
Flash Report: http://localhost:8888/flash-report/2024-2662
```

### Building
```bash
# Build the application
npm run build
```

### Deployment
The application is automatically deployed to Netlify when changes are pushed to the main branch.

## Components

### Shared Components
- **MaritimeMap**: Interactive map component used across both weekly and flash reports
  - Uses Mapbox GL for rendering
  - Supports multiple incident types
  - Custom markers and popups

### Weekly Report Components
- **ExecutiveBrief**: Overview of global maritime security situation
- **RegionalBrief**: Detailed analysis of specific regions
- **IncidentDetails**: Individual incident information

### Flash Report Components
- **EmailTemplate**: Email notification template
- **PreviewMode**: Flash report preview interface

## Services

### Notification Service
- Novu integration for email notifications
- Customizable email templates
- Subscriber management

## Utilities

- **airtable.js**: Airtable integration and data handling
- **api.js**: API interaction utilities
- **coordinates.js**: Geographic coordinate handling
- **dates.js**: Date formatting and calculations
- **trend-api.js**: Trend analysis utilities

## Environment Variables

Required environment variables:
- `VITE_MAPBOX_TOKEN`: Mapbox GL access token
- `VITE_NOVU_APP_IDENTIFIER`: Novu application identifier (for notifications)
