# Flash Report System Architecture

This document outlines the technical architecture of the Flash Report system, explaining how the components interact and the data flow process.

## System Components

The Flash Report system consists of several key components:

1. **Client-Side Application**: Frontend interface that initiates flash report requests
2. **Serverless Functions**: Netlify functions that handle the business logic and email delivery
3. **External Services**:
   - **SendGrid**: Email delivery service
   - **Mapbox**: Static map generation service
   - **Airtable**: Incident and vessel data source

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│                 │     │                      │     │             │
│  Client-Side    │────▶│ test-flash-report.js │────▶│             │
│  Application    │     │ Function             │     │             │
│                 │     │                      │     │             │
└─────────────────┘     └──────────────────────┘     │             │
                                 │                   │             │
                                 │                   │ send-flash- │     ┌─────────────┐
                                 └──────────────────▶│ report.js   │────▶│  SendGrid   │
┌─────────────────┐                                  │ Function    │     │  Email API  │
│                 │     ┌──────────────────────┐     │             │     └─────────────┘
│  Direct API     │────▶│ send-flash-report.js │────▶│             │
│  Integration    │     │ Function             │     │             │     ┌─────────────┐
│                 │     │                      │     │             │────▶│  Mapbox     │
└─────────────────┘     └──────────────────────┘     │             │     │  Static API │
                                                     └─────────────┘     └─────────────┘
                                                           │
                                                           │             ┌─────────────┐
                                                           │             │             │
                                                           └────────────▶│  Airtable   │
                                                                         │  API        │
                                                                         │             │
                                                                         └─────────────┘
```

## Data Flow

1. **Request Initiation**:
   - A flash report request is initiated either through the client-side application or a direct API integration
   - For testing purposes, the request can go through the `test-flash-report.js` function

2. **Data Retrieval**:
   - The `send-flash-report.js` function fetches incident data from Airtable
   - Vessel data is retrieved through multiple strategies:
     - From direct vessel references in the incident record
     - From the incident-vessel join table
     - By looking up vessels by IMO number using `getVesselByIMO()`
     - By looking up vessels by name using `getVesselByName()`
     - By looking up vessels by ID using `getVesselById()`
     - As a last resort, from embedded vessel fields in the incident record
   - For testing or when Airtable is unavailable, sample data can be used

3. **Map Generation**:
   - If coordinates are available, a static map is generated using the Mapbox API
   - The map shows the incident location with a marker colored according to incident type

4. **Email Preparation**:
   - HTML email content is generated with incident details, vessel information, and embedded map
   - MARA branding is consistently applied to all emails for a unified brand experience
   - A secure token with 1-year validity is generated for each recipient
   - The layout displays quick facts grid before the location map for improved readability

5. **Link Generation**:
   - Each email contains a link to view the report online
   - Link branding (client or default) is determined based on recipient's email domain
   - Public URLs are created with the generated tokens

6. **Email Delivery**:
   - Emails are sent to all recipients using the SendGrid API
   - Results are tracked for each recipient

7. **Response**:
   - The function returns a response with success/failure status for each recipient
   - In development environments without SendGrid API keys, email content is returned for inspection

## Security Considerations

1. **API Keys**:
   - All API keys (SendGrid, Mapbox) are stored as environment variables
   - Keys are never exposed to the client-side application

2. **CORS Protection**:
   - API endpoints are protected with proper CORS headers
   - Only authorized origins can access the endpoints

3. **Data Validation**:
   - All input data is validated before processing
   - Required fields are checked to prevent incomplete data processing

## Error Handling

The system includes robust error handling at various levels:

1. **Input Validation Errors**: Return 400 Bad Request with specific validation messages
2. **Incident Not Found**: Return 404 Not Found with the incident ID that wasn't found
3. **External API Errors**: 
   - Airtable connectivity issues trigger fallback to sample data
   - SendGrid errors are caught and reported per recipient
   - Mapbox errors result in fallback to placeholder images
4. **System Errors**: Return 500 Internal Server Error with error details

## Scalability

The Flash Report system is designed to scale efficiently:

1. **Serverless Architecture**: Functions scale automatically based on demand
2. **Parallel Processing**: Multiple recipient emails are processed concurrently
3. **Stateless Design**: Each function invocation is independent, allowing horizontal scaling
4. **Minimal Payloads**: Only necessary data is passed between functions and services