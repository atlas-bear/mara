# Weekly Report API Reference

This document provides details on the API endpoints used by the Weekly Report system.

## Endpoints

### Get Weekly Incidents

Retrieves incident data for a specific date range.

- **URL**: `/.netlify/functions/get-weekly-incidents`
- **Method**: `GET`
- **Query Parameters**:
  - `start` (required): ISO date string for the start of the reporting period
  - `end` (required): ISO date string for the end of the reporting period

**Example Request:**
```
GET /.netlify/functions/get-weekly-incidents?start=2025-03-17T21:00:00.000Z&end=2025-03-24T21:00:00.000Z
```

**Example Response:**
```json
{
  "incidents": [
    {
      "incident": {
        "id": "rec12345",
        "fields": {
          "title": "Robbery - M/V Example",
          "date_time_utc": "2025-03-18T14:30:00.000Z",
          "region": "West Africa",
          "latitude": 4.123,
          "longitude": 7.456,
          "description": "Vessel reported robbery while anchored..."
        }
      },
      "incidentType": {
        "fields": {
          "name": "Robbery"
        }
      }
    },
    // Additional incidents...
  ],
  "latestIncidents": {
    "West Africa": { /* incident data */ },
    "Southeast Asia": { /* incident data */ },
    // Other regions...
  }
}
```

### Get Weekly Report Content

Retrieves or generates AI content for the weekly report.

- **URL**: `/.netlify/functions/get-weekly-report-content`
- **Method**: `GET`
- **Query Parameters**:
  - `start` (required): ISO date string for the start of the reporting period
  - `end` (required): ISO date string for the end of the reporting period
- **Headers**:
  - `Cache-Control`: `public, max-age=86400` (24 hours client-side caching)
  - `X-Cache`: Indicates cache status (`HIT` or `MISS`)
  - `X-Cache-Source`: Indicates source of the cache (`weekly-background` or `on-demand-fallback`)

**Example Request:**
```
GET /.netlify/functions/get-weekly-report-content?start=2025-03-17T21:00:00.000Z&end=2025-03-24T21:00:00.000Z
```

**Example Response:**
```json
{
  "keyDevelopments": [
    {
      "region": "West Africa",
      "level": "orange",
      "content": "Significant increase in robbery incidents reported near Lagos anchorage, with three vessels targeted in a 48-hour period."
    },
    {
      "region": "Southeast Asia",
      "level": "red",
      "content": "Armed attack on cargo vessel in Singapore Strait resulted in injury to crew member and theft of ship's stores."
    },
    // Additional key developments...
  ],
  "forecast": [
    {
      "region": "West Africa",
      "trend": "up",
      "content": "Expect continued elevated risk in Lagos anchorage. Vessels should maintain highest vigilance and BMP West Africa implementation."
    },
    {
      "region": "Southeast Asia",
      "trend": "stable",
      "content": "Robbery incidents likely to remain consistent in Singapore Strait. Enhanced vigilance recommended, particularly during hours of darkness."
    },
    // Additional forecast items...
  ],
  "timestamp": "2025-03-24T21:05:12.345Z",
  "expiresAt": "2025-03-31T21:05:12.345Z"
}
```

### Get Weekly Report Content Background

Scheduled function that runs automatically to generate and cache weekly report content.

- **URL**: `/.netlify/functions/get-weekly-report-content-background`
- **Method**: `GET` (Normally triggered by scheduler)
- **Query Parameters**:
  - `debug` (optional): Set to `true` to test date calculations
  - `testCache` (optional): Set to `true` to test the caching system

**Example Request for debugging:**
```
GET /.netlify/functions/get-weekly-report-content-background?debug=true
```

**Example Response:**
```json
{
  "message": "Debug tests completed, check function logs for results"
}
```

### Get Trend Data

Retrieves historical trend data for incident analysis.

- **URL**: `/.netlify/functions/get-trend-data`
- **Method**: `GET`

**Example Response:**
```json
{
  "historicalTrends": {
    "West Africa": [
      { "month": "Oct", "value": 12 },
      { "month": "Nov", "value": 9 },
      { "month": "Dec", "value": 7 },
      { "month": "Jan", "value": 8 },
      { "month": "Feb", "value": 10 },
      { "month": "Mar", "value": 11 }
    ],
    "Southeast Asia": [
      { "month": "Oct", "value": 15 },
      { "month": "Nov", "value": 18 },
      { "month": "Dec", "value": 14 },
      { "month": "Jan", "value": 16 },
      { "month": "Feb", "value": 17 },
      { "month": "Mar", "value": 18 }
    ],
    // Other regions...
  }
}
```

## Cache Implementation

The Weekly Report uses Netlify Blob Storage for server-side caching:

- **Cache Key Format**: `weekly-report-content-${startISOString}-${endISOString}`
- **TTL**: 7 days (604,800,000 milliseconds)
- **Implementation**: See `/functions/utils/weekly-report-cache.js`

## Error Handling

All API endpoints return appropriate error responses:

- **400 Bad Request**: Missing required parameters
- **500 Internal Server Error**: Server-side processing errors

Example error response:
```json
{
  "error": "Failed to generate weekly report content",
  "details": "Error message details"
}
```

## Rate Limiting

- There are no explicit rate limits, but excessive usage may be throttled by the platform
- Use the cache system as designed to minimize API calls

## CORS Support

All endpoints include CORS headers to support cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: GET, OPTIONS
```