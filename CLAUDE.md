# MARA Project Documentation

This file serves as documentation for the MARA (Maritime Risk Analysis) project to help Claude provide consistent assistance across sessions.

## Project Overview

MARA is a maritime security application that tracks and reports on maritime incidents such as piracy, robbery, hijacking, and other security threats. Key features include Flash Reports (email alerts for new incidents) and Weekly Reports (comprehensive security summaries).

## Build Commands

```bash
# Development
npm run dev                     # Run all packages
npm run dev -- --filter @mara/app  # Run specific app

# Build
npm run build                   # Build all packages
npm run clean                   # Clean and reinstall dependencies

# Test Flash Report
curl -X POST https://your-netlify-site.netlify.app/.netlify/functions/test-flash-report \
-H "Content-Type: application/json" \
-d '{"recipientEmail":"test@example.com","useDemoIncident":true}'
```

## Code Style Guidelines

- **Components:** React functional components with hooks
- **Styling:** Tailwind CSS for UI components
- **Error Handling:** Try/catch with consistent error objects
- **Imports:** React first, then external libs, then internal modules
- **File Structure:** Feature-based organization

## Project Structure

- `/src/apps/mara`: Main application
- `/src/apps/client`: White-labeled client app
- `/src/shared`: Reusable components
- `/functions`: Netlify serverless functions
- `/docs`: Documentation

## Flash Report System

Key components:
- `/functions/send-flash-report.js`: Email generation
- `/functions/utils/vessel-utils.js`: Vessel data lookup
- `/functions/utils/incident-utils.js`: Incident data
- `/functions/utils/token-utils.js`: Secure link tokens
- `/src/apps/mara/components/FlashReport/`: UI components

## Data Flow for Vessel Information

1. Incident data fetched from Airtable using `getIncident()`
2. Vessel data sources (in priority order):
   - Direct vessel reference in incident record
   - Join table (incident_vessel)
   - Lookup by IMO/name via utility functions
   - Embedded vessel fields as fallback

## Logging & Debugging

Check Netlify function logs for:
- "DEBUG - VESSEL DATA BEING SENT TO EMAIL"
- "VESSEL DATA DEBUG"
- "Using vessel data source:"