---
id: hotspots
title: Hotspots API
sidebar_label: Hotspots
---

# Hotspots API

The Hotspots API provides information about current security hotspots identified by MARA. Hotspots represent areas with concentrated security incidents or elevated risk levels that require special attention.

## Get All Hotspots

Retrieves a list of current security hotspots.

```
GET /hotspots
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of records to return (default: 20, max: 100) |
| `offset` | integer | No | Number of records to skip (default: 0) |
| `region` | string | No | Filter by geographic region |
| `country` | string | No | Filter by country code (ISO 3166-1 alpha-2) |
| `severity` | string | No | Filter by severity level (critical, high, medium, low) |
| `type` | string | No | Filter by hotspot type (e.g., piracy, civil_unrest) |

### Response

```json
{
  "data": [
    {
      "id": "hs-2023-087",
      "title": "Increased Piracy Activity off Gulf of Guinea",
      "description": "Multiple piracy incidents reported in the last 72 hours",
      "location": {
        "region": "West Africa",
        "primary_country": "NG",
        "countries": ["NG", "TG", "BJ"],
        "coordinates": [3.2456, 6.4951],
        "radius_nm": 150
      },
      "severity": "high",
      "type": "piracy",
      "created_at": "2023-09-15T00:00:00Z",
      "expires_at": "2023-09-22T00:00:00Z",
      "incident_count": 5,
      "status": "active"
    },
    {
      "id": "hs-2023-086",
      "title": "Civil Unrest at Chittagong Port",
      "description": "Labor disputes leading to disruption of port operations",
      "location": {
        "region": "South Asia",
        "primary_country": "BD",
        "countries": ["BD"],
        "coordinates": [91.8123, 22.3419],
        "radius_nm": 25
      },
      "severity": "medium",
      "type": "civil_unrest",
      "created_at": "2023-09-14T00:00:00Z",
      "expires_at": "2023-09-21T00:00:00Z",
      "incident_count": 2,
      "status": "active"
    }
  ],
  "meta": {
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

## Get Hotspot Details

Retrieves detailed information about a specific hotspot.

```
GET /hotspots/{hotspot_id}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hotspot_id` | string | Yes | Unique identifier of the hotspot |

### Response

```json
{
  "data": {
    "id": "hs-2023-087",
    "title": "Increased Piracy Activity off Gulf of Guinea",
    "description": "Multiple piracy incidents reported in the last 72 hours. Vessels are advised to maintain heightened vigilance and implement anti-piracy measures when transiting through or operating in this area.",
    "location": {
      "region": "West Africa",
      "primary_country": "NG",
      "countries": ["NG", "TG", "BJ"],
      "coordinates": [3.2456, 6.4951],
      "radius_nm": 150,
      "bounding_box": {
        "sw": [1.1456, 4.3951],
        "ne": [5.3456, 8.5951]
      }
    },
    "severity": "high",
    "type": "piracy",
    "created_at": "2023-09-15T00:00:00Z",
    "updated_at": "2023-09-16T12:30:00Z",
    "expires_at": "2023-09-22T00:00:00Z",
    "incident_count": 5,
    "status": "active",
    "incidents": [
      {
        "id": "inc-12345",
        "title": "Attempted boarding of cargo vessel",
        "date": "2023-09-15T08:30:00Z",
        "coordinates": [3.2345, 6.5432],
        "severity": "medium"
      },
      {
        "id": "inc-12346",
        "title": "Suspicious approach to tanker",
        "date": "2023-09-14T14:15:00Z",
        "coordinates": [3.5678, 6.7654],
        "severity": "medium"
      }
    ],
    "recommendations": [
      "Maintain 24-hour visual and radar watch",
      "Report all suspicious activity to authorities",
      "Consider armed security personnel",
      "Follow BMP5 guidelines",
      "Monitor communications channels for alerts"
    ],
    "related_reports": [
      {
        "id": "rep-789",
        "title": "Weekly Piracy Update - Gulf of Guinea",
        "date": "2023-09-15T00:00:00Z"
      }
    ],
    "risk_forecast": {
      "trend": "increasing",
      "forecast": "The situation is expected to persist for at least 7 days. Additional naval patrols have been deployed to the area but have not yet had a significant impact on piracy activity."
    }
  }
}
```

## Get Active Hotspots Map Data

Retrieves geospatial data for all currently active hotspots, suitable for map visualization.

```
GET /hotspots/map
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Response format (geojson, simplified) - default: geojson |
| `region` | string | No | Filter by geographic region |
| `severity` | string | No | Filter by minimum severity level (critical, high, medium, low) |

### Response (GeoJSON format)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [3.2456, 6.4951]
      },
      "properties": {
        "id": "hs-2023-087",
        "title": "Increased Piracy Activity off Gulf of Guinea",
        "severity": "high",
        "type": "piracy",
        "radius_nm": 150,
        "incident_count": 5
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [91.8123, 22.3419]
      },
      "properties": {
        "id": "hs-2023-086",
        "title": "Civil Unrest at Chittagong Port",
        "severity": "medium",
        "type": "civil_unrest",
        "radius_nm": 25,
        "incident_count": 2
      }
    }
  ]
}
```

## Get Hotspot History

Retrieves historical hotspot data for analysis and trend monitoring.

```
GET /hotspots/history
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | Yes | Start date for history (YYYY-MM-DD) |
| `end_date` | string | Yes | End date for history (YYYY-MM-DD) |
| `region` | string | No | Filter by geographic region |
| `country` | string | No | Filter by country code (ISO 3166-1 alpha-2) |
| `type` | string | No | Filter by hotspot type |
| `interval` | string | No | Group by interval (day, week, month) - default: week |

### Response

```json
{
  "data": {
    "total_hotspots": 42,
    "by_severity": {
      "critical": 5,
      "high": 18,
      "medium": 15,
      "low": 4
    },
    "by_type": {
      "piracy": 23,
      "civil_unrest": 8,
      "terrorism": 5,
      "armed_conflict": 3,
      "other": 3
    },
    "trend": [
      {
        "period": "2023-07-03",
        "count": 8,
        "by_severity": {
          "critical": 1,
          "high": 3,
          "medium": 3,
          "low": 1
        }
      },
      {
        "period": "2023-07-10",
        "count": 10,
        "by_severity": {
          "critical": 1,
          "high": 4,
          "medium": 4,
          "low": 1
        }
      },
      {
        "period": "2023-07-17",
        "count": 7,
        "by_severity": {
          "critical": 0,
          "high": 3,
          "medium": 3,
          "low": 1
        }
      }
    ],
    "regions": {
      "West Africa": 12,
      "Southeast Asia": 10,
      "Middle East": 7,
      "South America": 5,
      "East Africa": 4,
      "South Asia": 4
    }
  }
}
```
