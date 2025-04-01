# Weekly Report Implementation

This document provides technical details on the implementation of the Weekly Report feature.

## Component Structure

The Weekly Report is built using a hierarchical component structure:

```
WeeklyReportPage
├── ExecutiveBrief
│   ├── Global Threat Overview
│   ├── Key Developments (AI-generated)
│   └── 7-Day Forecast (AI-generated)
├── RegionalBrief (for each region)
│   ├── Regional Map
│   ├── Threat Assessment
│   └── Regional Statistics
└── IncidentDetails (for each incident)
    ├── Incident Map
    ├── Vessel Information
    └── Incident Description
```

## File Structure

Key files in the implementation:

```
/src/shared/features/weekly-report/
├── components/
│   ├── ExecutiveBrief/
│   │   └── index.jsx               # Executive summary component
│   ├── RegionalBrief/
│   │   └── index.jsx               # Regional analysis component
│   └── IncidentDetails/
│       └── index.jsx               # Incident details component
├── utils/
│   ├── dates.js                    # Date handling functions
│   ├── report-data.js              # Data fetching and state management
│   ├── client-api.js               # Client-side API calls
│   └── trend-api.js                # Historical trend data access
└── index.js                        # Feature exports

/functions/
├── get-weekly-incidents.js         # Serverless function for incident data
├── get-weekly-report-content.js    # On-demand report content generation
├── get-weekly-report-content-background.js # Scheduled content generation
├── send-weekly-report-notification.js # Scheduled email notification (Tuesdays)
├── test-weekly-notification.js     # Test endpoint for email notifications
└── utils/
    ├── weekly-report-cache.js      # 7-day caching implementation
    ├── llm-service.js              # AI service integration
    └── supabase.js                 # Database access including user subscriptions
```

## Client-Side Components

### ExecutiveBrief

The `ExecutiveBrief` component provides a high-level overview of maritime security:

```jsx
<ExecutiveBrief 
  incidents={incidents} 
  start={start} 
  end={end}
  yearWeek={activeYearWeek}
/>
```

Key features:
- Displays week number and date range
- Shows interactive map of all incidents
- Presents threat levels by region
- Displays AI-generated key developments
- Shows AI-generated 7-day forecast

### RegionalBrief

The `RegionalBrief` component provides region-specific analysis:

```jsx
<RegionalBrief 
  incidents={regionIncidents}
  latestIncidents={{ [region]: latestRegionIncident }}
  currentRegion={region}
  start={start} 
  end={end}
/>
```

### IncidentDetails

The `IncidentDetails` component shows detailed information for a specific incident:

```jsx
<IncidentDetails 
  incident={incident}
  showHistoricalContext={false}
  useInteractiveMap={false} // Uses StaticMap by default to avoid WebGL context limits
/>
```

The `useInteractiveMap` prop determines which map component to use:
- `false` (default): Uses the lightweight StaticMap component (recommended for Weekly Reports)
- `true`: Uses the interactive MaritimeMap component (used in Flash Reports)

## Serverless Functions

### get-weekly-incidents.js

Retrieves incidents for a specified date range from the data source:

```javascript
// Example request
GET /.netlify/functions/get-weekly-incidents?start=2025-03-17T21:00:00.000Z&end=2025-03-24T21:00:00.000Z
```

### get-weekly-report-content.js

On-demand generation of AI content for the weekly report:

```javascript
// Example request
GET /.netlify/functions/get-weekly-report-content?start=2025-03-17T21:00:00.000Z&end=2025-03-24T21:00:00.000Z
```

Response format:
```json
{
  "keyDevelopments": [
    { "region": "West Africa", "level": "orange", "content": "..." },
    // More developments...
  ],
  "forecast": [
    { "region": "Southeast Asia", "trend": "up", "content": "..." },
    // More forecasts...
  ]
}
```

### get-weekly-report-content-background.js

Scheduled function that runs every Monday at 21:00 UTC to generate and cache weekly report content for the period that just ended.

### send-weekly-report-notification.js

Scheduled function that runs every Tuesday at 08:00 UTC to send email notifications about the newly available weekly report to subscribed users.

### test-weekly-notification.js

Testing endpoint for manually triggering weekly report email notifications without waiting for the scheduled run.

## Caching Implementation

The Weekly Report uses a 7-day caching strategy to optimize performance:

1. The background function generates content every Monday at 21:00 UTC
2. Content is stored in Netlify Blob Storage with a 7-day TTL
3. Client requests check the cache first
4. If no cache exists, the on-demand function generates the content

```javascript
// Cache key format
weeklyReportCache.getKey(startDate.toISOString(), endDate.toISOString());
```

## Multi-Tenant Support

The implementation supports white-labeled client applications:

1. Core components are in the shared features directory
2. Client-specific styling is applied in client applications
3. Company branding is dynamically applied through a branding provider

## Testing

Test the Weekly Report feature:

1. Verify date calculations with `?debug=true` parameter
2. Test cache operations with `?testCache=true` parameter
3. Manually trigger the background function for testing