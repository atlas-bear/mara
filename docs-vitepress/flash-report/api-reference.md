# Flash Report API Reference

This document provides detailed information about the Flash Report API endpoints, request formats, and response structures.

## Send Flash Report

Endpoint: `/.netlify/functions/send-flash-report`

Method: `POST`

This endpoint sends flash report emails to specified recipients with incident information.

### Request Format

```json
{
  "incidentId": "2024-2662",
  "recipients": [
    {
      "email": "recipient@example.com"
    }
  ],
  "customBranding": {
    "logo": "https://example.com/logo.png",
    "companyName": "Example Company",
    "colors": {
      "primary": "#0047AB",
      "secondary": "#FF6B00"
    }
  },
  "templateOverrides": {
    // Optional template customization parameters
  }
}
```

#### Required Parameters

- `incidentId`: The unique identifier for the incident (corresponds to Airtable record ID)
- `recipients`: Array of recipient objects, each containing:
  - `email`: Email address of the recipient
  - `isClient` (deprecated): No longer used as client status is determined by email domain

#### Optional Parameters

- `customBranding` (legacy support): Object containing branding overrides. Note that as of the latest update, emails always use MARA branding regardless of this parameter, but it's maintained for backward compatibility:
  - `logo`: URL to the logo image
  - `companyName`: Name of the company for branding
  - `colors`: Object containing color codes:
    - `primary`: Primary color (hex code)
    - `secondary`: Secondary color (hex code)
- `templateOverrides`: Object containing any template-specific overrides

### Response Format

#### Success Response (200 OK)

```json
{
  "message": "Flash report sent",
  "results": [
    {
      "email": "recipient@example.com",
      "status": "sent",
      "publicUrl": "https://mara-v2.netlify.app/public/flash-report/2024-2662/a1b2c3d4..."
    }
  ]
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Missing required fields"
}
```

**404 Not Found**
```json
{
  "error": "Incident with ID 2024-2662 not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Error sending flash report",
  "message": "Error details here"
}
```

