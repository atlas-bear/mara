# Weekly Report Data Flow

This document explains the flow of data through the Weekly Report system, from data retrieval to display.

## Overview

The Weekly Report uses a tiered architecture for data flow:

1. **Client-Side:** The browser-based UI that displays the report
2. **Serverless Functions:** Intermediate API layer that performs data processing
3. **Data Sources:** Backend systems where incident data is stored

## Data Flow Diagram

```
┌───────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Client Browser │────▶│ Serverless       │────▶│ Data Sources│
│               │◀────│ Functions         │◀────│             │
└───────────────┘     └──────────────────┘     └─────────────┘
```

## Detailed Flow

### 1. Client Initialization

When a user visits a Weekly Report page:

1. The client application loads the `WeeklyReportPage` component
2. The URL is parsed to extract the year and week number (`/weekly-report/2025-12`)
3. The `getReportingWeek(year, week)` function calculates the date range
4. The component initializes with empty state

### 2. Incident Data Retrieval

To populate the report with incident data:

1. The client calls `fetchWeeklyIncidents(start, end)`
2. This function makes an API request to the `get-weekly-incidents` serverless function
3. The serverless function queries the data source for incidents within the date range
4. The incident data is returned to the client
5. The client organizes incidents by region and updates the state

### 3. AI Content Generation

For the Key Developments and 7-Day Forecast sections:

1. The client calls `fetchWeeklyReportContent(start, end)`
2. This triggers an API request to the `get-weekly-report-content` serverless function
3. The serverless function first checks for cached content
4. If cached content exists, it's returned immediately
5. If no cache exists, the function:
   - Fetches incident data from the same data source
   - Retrieves historical trend data
   - Prepares data for AI analysis
   - Calls the AI service to generate insights
   - Caches the result for future requests
   - Returns the content to the client
6. The client updates the ExecutiveBrief with the AI-generated content

### 4. Background Generation

To optimize performance, a background process runs weekly:

1. The `get-weekly-report-content-background` function runs every Monday at 21:00 UTC
2. It calculates the reporting period that just ended
3. It generates content for that period using the same logic as the on-demand function
4. The content is stored in a cache with a 7-day TTL
5. Subsequent client requests can use this cached content

## Caching Strategy

The Weekly Report implements a tiered caching strategy:

1. **Server-Side Cache (7 days):**
   - Primary cache using Netlify Blob Storage
   - Stores AI-generated content for completed reporting periods
   - TTL of 7 days to cover the next weekly cycle
   - Reduces AI service usage and improves performance

2. **Client-Side Cache (24 hours):**
   - Browser caching through Cache-Control headers
   - Keeps report content available for the same user across sessions
   - Reduces API calls for the same report

## Error Handling

The data flow includes robust error handling:

1. **Cache Misses:** If cached content is not available, the system falls back to generating new content
2. **API Failures:** Client components handle API errors and show appropriate error messages
3. **Missing Data:** Default values and fallback content are provided when expected data is unavailable

## Security Considerations

The data flow is designed with security in mind:

1. **API Key Protection:** Server-side functions handle API keys, which are never exposed to the client
2. **Environment Variables:** Sensitive configuration is stored in environment variables
3. **CORS Headers:** API endpoints include appropriate CORS headers for security
4. **Data Validation:** Input validation is performed at each step of the flow