---
id: countries
title: Countries API
sidebar_label: Countries
---

# Countries API

The Countries API provides access to country risk indices and related security information tracked by MARA.

## Get All Countries

Retrieves a list of countries with their basic risk information.

```
GET /countries
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of records to return (default: 50, max: 200) |
| `offset` | integer | No | Number of records to skip (default: 0) |
| `region` | string | No | Filter by geographic region |
| `risk_min` | integer | No | Filter by minimum risk score (0-100) |
| `risk_max` | integer | No | Filter by maximum risk score (0-100) |

### Response

```json
{
  "data": [
    {
      "id": "NG",
      "name": "Nigeria",
      "region": "West Africa",
      "risk_index": 68,
      "risk_category": "high",
      "updated_at": "2023-09-12T00:00:00Z",
      "incident_count_30d": 12
    },
    {
      "id": "MY",
      "name": "Malaysia",
      "region": "Southeast Asia",
      "risk_index": 32,
      "risk_category": "medium",
      "updated_at": "2023-09-15T00:00:00Z",
      "incident_count_30d": 4
    }
  ],
  "meta": {
    "total": 196,
    "limit": 50,
    "offset": 0
  }
}
```

## Get Country Details

Retrieves detailed information about a specific country.

```
GET /countries/{country_code}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `country_code` | string | Yes | ISO 3166-1 alpha-2 country code |

### Response

```json
{
  "data": {
    "id": "NG",
    "name": "Nigeria",
    "region": "West Africa",
    "risk_index": 68,
    "risk_category": "high",
    "updated_at": "2023-09-12T00:00:00Z",
    "risk_factors": {
      "piracy": 75,
      "armed_robbery": 70,
      "kidnapping": 65,
      "civil_unrest": 60,
      "terrorism": 55
    },
    "ports": [
      {
        "id": "NGLOS",
        "name": "Lagos",
        "risk_index": 72,
        "incident_count_30d": 5
      },
      {
        "id": "NGLAG",
        "name": "Port Harcourt",
        "risk_index": 68,
        "incident_count_30d": 3
      }
    ],
    "incident_summary": {
      "total_count": 124,
      "by_severity": {
        "high": 42,
        "medium": 53,
        "low": 29
      },
      "by_type": {
        "piracy_attempt": 48,
        "armed_robbery": 32,
        "suspicious_approach": 25,
        "hijacking": 8,
        "other": 11
      },
      "trend": [
        {
          "period": "2023-04",
          "count": 12
        },
        {
          "period": "2023-05",
          "count": 10
        },
        {
          "period": "2023-06",
          "count": 8
        },
        {
          "period": "2023-07",
          "count": 11
        },
        {
          "period": "2023-08",
          "count": 9
        },
        {
          "period": "2023-09",
          "count": 12
        }
      ]
    },
    "travel_advisory": {
      "level": "high",
      "summary": "Exercise a high degree of caution due to the threat of piracy and armed robbery in coastal areas.",
      "last_updated": "2023-08-15T00:00:00Z"
    },
    "recommendations": [
      "Implement anti-piracy measures when operating in Nigerian waters",
      "Maintain 24-hour visual and radar watch",
      "Report all incidents immediately to authorities",
      "Consider armed security personnel when navigating high-risk areas"
    ],
    "recent_reports": [
      {
        "id": "rep-456",
        "title": "Quarterly Security Assessment - Nigeria",
        "date": "2023-09-01T00:00:00Z"
      }
    ]
  }
}
```

## Get Country Risk History

Retrieves historical risk indices for a specific country.

```
GET /countries/{country_code}/history
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `country_code` | string | Yes | ISO 3166-1 alpha-2 country code |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | No | Start date for history (YYYY-MM-DD) |
| `end_date` | string | No | End date for history (YYYY-MM-DD) |
| `interval` | string | No | Group by interval (day, week, month) - default: month |

### Response

```json
{
  "data": {
    "id": "NG",
    "name": "Nigeria",
    "history": [
      {
        "date": "2023-03-01T00:00:00Z",
        "risk_index": 72,
        "risk_category": "high",
        "incident_count": 13
      },
      {
        "date": "2023-04-01T00:00:00Z",
        "risk_index": 70,
        "risk_category": "high",
        "incident_count": 12
      },
      {
        "date": "2023-05-01T00:00:00Z",
        "risk_index": 71,
        "risk_category": "high",
        "incident_count": 10
      },
      {
        "date": "2023-06-01T00:00:00Z",
        "risk_index": 69,
        "risk_category": "high",
        "incident_count": 8
      },
      {
        "date": "2023-07-01T00:00:00Z",
        "risk_index": 70,
        "risk_category": "high",
        "incident_count": 11
      },
      {
        "date": "2023-08-01T00:00:00Z",
        "risk_index": 69,
        "risk_category": "high",
        "incident_count": 9
      },
      {
        "date": "2023-09-01T00:00:00Z",
        "risk_index": 68,
        "risk_category": "high",
        "incident_count": 12
      }
    ]
  }
}
```
