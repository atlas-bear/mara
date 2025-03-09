# MARA Project Documentation

This file serves as documentation for the MARA (Maritime Risk Analysis) project to help Claude provide consistent assistance across sessions.

## Project Overview

MARA is a maritime security application that tracks and reports on maritime incidents such as piracy, robbery, hijacking, and other security threats. One of its key features is the Flash Report functionality, which sends email alerts to stakeholders when new incidents occur.

## Recent Work

### March 2025: Flash Report Email and Vessel Data Enhancements

1. **Improved vessel data extraction in flash report emails**:

   - Added multiple lookup strategies (ID, IMO, name) in `vessel-utils.js`
   - Fixed variable scoping issues in `send-flash-report.js`
   - Enhanced error handling and logging for vessel data
   - Added fallback mechanisms for missing vessel data

2. **Email template improvements**:
   - Moved quick facts grid before location map
   - Standardized on MARA branding for all emails
   - Extended link validity from 7 days to 1 year
   - Separated email branding (always MARA) from link branding (client-specific)

## Project Structure

Key components related to the Flash Report system:

- `/functions/send-flash-report.js`: Serverless function for email generation
- `/functions/utils/vessel-utils.js`: Vessel data lookup functions
- `/functions/utils/incident-utils.js`: Incident data fetching
- `/functions/utils/token-utils.js`: Token generation for secure links
- `/src/apps/mara/components/FlashReport/`: UI components
- `/src/apps/mara/routes/flash/PublicFlashReportPage.jsx`: Public view
- `/docs1/flash-report/`: Documentation for flash report features

## Common Commands and Patterns

### Netlify Functions

To check logs from the `send-flash-report` function, go to the Netlify dashboard > Functions > send-flash-report > Recent invocations.

Look for log lines containing:

- "DEBUG - VESSEL DATA BEING SENT TO EMAIL"
- "VESSEL DATA DEBUG"
- "Using vessel data source:"

### Development Flow

When making changes to the flash report system:

1. Update the appropriate files in `/functions/` or `/src/`
2. Commit changes with descriptive messages
3. Deploy to Netlify
4. Test by sending a flash report
5. Check logs for correct vessel data extraction

### Data Flow for Vessel Information

1. Incident data is fetched from Airtable using `getIncident()`
2. Vessel data may come from:
   - Direct vessel references in the incident record
   - Join table (incident_vessel)
   - Lookup by IMO number using `getVesselByIMO()`
   - Lookup by vessel name using `getVesselByName()`
   - Embedded vessel fields in the incident record as fallback

The enhanced vessel data is then used to populate the email template.
