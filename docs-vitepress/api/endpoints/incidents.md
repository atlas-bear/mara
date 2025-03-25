# Incidents API

The Incidents API provides access to security-related incident data tracked by MARA. This endpoint allows you to query, filter, and retrieve detailed information about incidents across various regions.

## Get All Incidents

Retrieves a paginated list of incidents.

```
GET /incidents
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of records to return (default: 20, max: 100) |
| `offset` | integer | No | Number of records to skip (default: 0) |
| `region` | string | No | Filter by geographic region |
| `country` | string | No | Filter by country code (ISO 3166-1 alpha-2) |
| `type` | string | No | Filter by incident type |
| `severity` | string | No | Filter by severity level (low, medium, high) |
| `start_date` | string | No | Filter incidents on or after this date (YYYY-MM-DD) |
| `end_date` | string | No | Filter incidents on or before this date (YYYY-MM-DD) |

### Response

```json
{
  "data": [
    {
      "id": "inc-12345",
      "type": "piracy_attempt",
      "title": "Attempted boarding of cargo vessel",
      "description": "Attempted boarding of cargo vessel 25nm off the coast",
      "location": {
        "country": "NG",
        "region": "West Africa",
        "coordinates": [3.2345, 6.5432]
      },
      "date": "2023-09-15T08:30:00Z",
      "severity": "medium",
      "source": "MARA intelligence network",
      "related_reports": ["rep-789", "rep-790"]
    },
    {
      "id": "inc-12346",
      "type": "armed_robbery",
      "title": "Armed robbery at port facility",
      "description": "Armed individuals gained access to a port storage facility",
      "location": {
        "country": "MY",
        "region": "Southeast Asia",
        "coordinates": [101.7068, 3.1390]
      },
      "date": "2023-09-14T22:15:00Z",
      "severity": "high",
      "source": "Local authorities",
      "related_reports": ["rep-791"]
    }
  ],
  "meta": {
    "total": 427,
    "limit": 20,
    "offset": 0
  }
}
```

## Get Incident Details

Retrieves detailed information about a specific incident.

```
GET /incidents/{incident_id}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `incident_id` | string | Yes | Unique identifier of the incident |

### Response

```json
{
  "data": {
    "id": "inc-12345",
    "type": "piracy_attempt",
    "title": "Attempted boarding of cargo vessel",
    "description": "At approximately 08:30 UTC, a cargo vessel reported an attempted boarding by 6 individuals in a small craft 25nm off the coast. The vessel implemented evasive maneuvers and the security team deployed deterrents. No boarding occurred and the vessel continued its journey without further incident.",
    "location": {
      "country": "NG",
      "region": "West Africa",
      "port_proximity": "Lagos (25nm)",
      "coordinates": [3.2345, 6.5432]
    },
    "date": "2023-09-15T08:30:00Z",
    "severity": "medium",
    "source": "MARA intelligence network",
    "vessel_details": {
      "name": "MV Stellar Navigator",
      "type": "Cargo vessel",
      "flag": "LR"
    },
    "actions_taken": [
      "Evasive maneuvers",
      "Security protocols implemented",
      "Reported to local authorities"
    ],
    "impact": {
      "casualties": 0,
      "damages": "None reported",
      "operational": "Minor delay"
    },
    "related_reports": ["rep-789", "rep-790"],
    "tags": ["piracy", "west-africa", "gulf-of-guinea"]
  }
}
```

## Create an Incident Report

Submits a new incident report to the MARA system.

```
POST /incidents
```

### Request Body

```json
{
  "type": "piracy_attempt",
  "title": "Attempted boarding of cargo vessel",
  "description": "At approximately 08:30 UTC, a cargo vessel reported an attempted boarding by 6 individuals in a small craft 25nm off the coast.",
  "location": {
    "country": "NG",
    "coordinates": [3.2345, 6.5432]
  },
  "date": "2023-09-15T08:30:00Z",
  "severity": "medium",
  "source": "Direct vessel report",
  "vessel_details": {
    "name": "MV Stellar Navigator",
    "type": "Cargo vessel",
    "flag": "LR"
  },
  "actions_taken": [
    "Evasive maneuvers",
    "Security protocols implemented",
    "Reported to local authorities"
  ],
  "impact": {
    "casualties": 0,
    "damages": "None reported",
    "operational": "Minor delay"
  },
  "tags": ["piracy", "west-africa", "gulf-of-guinea"]
}
```

### Response

```json
{
  "data": {
    "id": "inc-12345",
    "status": "submitted",
    "message": "Incident report successfully submitted"
  }
}
```

## Incident Analysis

Retrieve analysis data for incidents matching specific criteria.

```
GET /incidents/analysis
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | No | Filter by geographic region |
| `country` | string | No | Filter by country code (ISO 3166-1 alpha-2) |
| `type` | string | No | Filter by incident type |
| `start_date` | string | Yes | Start date for analysis (YYYY-MM-DD) |
| `end_date` | string | Yes | End date for analysis (YYYY-MM-DD) |
| `interval` | string | No | Time grouping interval (day, week, month) - default: month |

### Response

```json
{
  "data": {
    "total_incidents": 245,
    "by_severity": {
      "high": 45,
      "medium": 112,
      "low": 88
    },
    "by_type": {
      "piracy_attempt": 78,
      "armed_robbery": 45,
      "suspicious_approach": 92,
      "hijacking": 12,
      "other": 18
    },
    "trend": [
      {
        "period": "2023-07",
        "count": 35,
        "by_severity": {
          "high": 7,
          "medium": 16,
          "low": 12
        }
      },
      {
        "period": "2023-08",
        "count": 42,
        "by_severity": {
          "high": 8,
          "medium": 20,
          "low": 14
        }
      },
      {
        "period": "2023-09",
        "count": 38,
        "by_severity": {
          "high": 6,
          "medium": 18,
          "low": 14
        }
      }
    ]
  }
}
```