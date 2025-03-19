---
id: ports
title: Ports API
sidebar_label: Ports
---

# Ports API

The Ports API provides access to port safety information, risk indices, and related security data tracked by MARA.

## Get All Ports

Retrieves a list of ports with their basic safety information.

```
GET /ports
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of records to return (default: 50, max: 200) |
| `offset` | integer | No | Number of records to skip (default: 0) |
| `country` | string | No | Filter by country code (ISO 3166-1 alpha-2) |
| `region` | string | No | Filter by geographic region |
| `risk_min` | integer | No | Filter by minimum risk score (0-100) |
| `risk_max` | integer | No | Filter by maximum risk score (0-100) |
| `search` | string | No | Search port names |

### Response

```json
{
  "data": [
    {
      "id": "NGLOS",
      "name": "Lagos",
      "country": "NG",
      "country_name": "Nigeria",
      "region": "West Africa",
      "coordinates": [3.3792, 6.4531],
      "risk_index": 72,
      "risk_category": "high",
      "updated_at": "2023-09-12T00:00:00Z",
      "incident_count_30d": 5
    },
    {
      "id": "MYPKG",
      "name": "Port Klang",
      "country": "MY",
      "country_name": "Malaysia",
      "region": "Southeast Asia",
      "coordinates": [101.4043, 2.9901],
      "risk_index": 28,
      "risk_category": "low",
      "updated_at": "2023-09-15T00:00:00Z",
      "incident_count_30d": 1
    }
  ],
  "meta": {
    "total": 523,
    "limit": 50,
    "offset": 0
  }
}
```

## Get Port Details

Retrieves detailed information about a specific port.

```
GET /ports/{port_id}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `port_id` | string | Yes | Port identifier (typically UN/LOCODE) |

### Response

```json
{
  "data": {
    "id": "NGLOS",
    "name": "Lagos",
    "alt_names": ["Apapa", "Lagos Port Complex"],
    "country": "NG",
    "country_name": "Nigeria",
    "region": "West Africa",
    "coordinates": [3.3792, 6.4531],
    "risk_index": 72,
    "risk_category": "high",
    "updated_at": "2023-09-12T00:00:00Z",
    "risk_factors": {
      "piracy": 75,
      "armed_robbery": 70,
      "theft": 65,
      "stowaways": 60,
      "corruption": 65
    },
    "security_level": {
      "isps_level": 2,
      "last_changed": "2023-05-10T00:00:00Z"
    },
    "incident_summary": {
      "total_count": 47,
      "by_severity": {
        "high": 18,
        "medium": 20,
        "low": 9
      },
      "by_type": {
        "piracy_attempt": 12,
        "armed_robbery": 15,
        "theft": 10,
        "stowaway": 7,
        "other": 3
      },
      "trend": [
        {
          "period": "2023-04",
          "count": 4
        },
        {
          "period": "2023-05",
          "count": 5
        },
        {
          "period": "2023-06",
          "count": 3
        },
        {
          "period": "2023-07",
          "count": 6
        },
        {
          "period": "2023-08",
          "count": 4
        },
        {
          "period": "2023-09",
          "count": 5
        }
      ]
    },
    "facilities": {
      "terminals": [
        {
          "name": "Apapa Container Terminal",
          "type": "container",
          "risk_index": 68
        },
        {
          "name": "Lagos Bulk Terminal",
          "type": "bulk",
          "risk_index": 74
        }
      ],
      "anchorages": [
        {
          "name": "Lagos Secure Anchorage Area",
          "coordinates": [3.3500, 6.3800],
          "risk_index": 70
        }
      ]
    },
    "security_measures": {
      "port_security": "Limited capacity with some vulnerabilities",
      "naval_presence": "Regular patrols with moderate response capability",
      "access_control": "Basic systems with inconsistent implementation",
      "screening": "Limited screening of cargo and personnel"
    },
    "recommendations": [
      "Implement anti-theft measures for vessel and cargo",
      "Maintain vigilant watch while at berth and anchorage",
      "Secure accommodation and storage areas",
      "Report all incidents to port authorities and MARA",
      "Consider additional private security when necessary"
    ],
    "recent_incidents": [
      {
        "id": "inc-12350",
        "title": "Theft from vessel at Lagos container terminal",
        "date": "2023-09-10T22:15:00Z",
        "severity": "medium"
      },
      {
        "id": "inc-12328",
        "title": "Armed robbery attempt at Lagos anchorage",
        "date": "2023-09-02T01:30:00Z",
        "severity": "high"
      }
    ],
    "contact_information": {
      "port_authority": {
        "name": "Nigerian Ports Authority - Lagos Port Complex",
        "phone": "+234-1-587-1040",
        "email": "info@lagosport.org",
        "website": "https://www.nigerianports.gov.ng"
      },
      "emergency": {
        "port_control": "+234-1-587-1045",
        "coast_guard": "+234-1-587-2000",
        "police": "+234-1-587-3000"
      }
    }
  }
}
```

## Get Port Risk History

Retrieves historical risk indices for a specific port.

```
GET /ports/{port_id}/history
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `port_id` | string | Yes | Port identifier (typically UN/LOCODE) |

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
    "id": "NGLOS",
    "name": "Lagos",
    "country": "NG",
    "history": [
      {
        "date": "2023-03-01T00:00:00Z",
        "risk_index": 75,
        "risk_category": "high",
        "incident_count": 5
      },
      {
        "date": "2023-04-01T00:00:00Z",
        "risk_index": 74,
        "risk_category": "high",
        "incident_count": 4
      },
      {
        "date": "2023-05-01T00:00:00Z",
        "risk_index": 76,
        "risk_category": "high",
        "incident_count": 5
      },
      {
        "date": "2023-06-01T00:00:00Z",
        "risk_index": 73,
        "risk_category": "high",
        "incident_count": 3
      },
      {
        "date": "2023-07-01T00:00:00Z",
        "risk_index": 74,
        "risk_category": "high",
        "incident_count": 6
      },
      {
        "date": "2023-08-01T00:00:00Z",
        "risk_index": 73,
        "risk_category": "high",
        "incident_count": 4
      },
      {
        "date": "2023-09-01T00:00:00Z",
        "risk_index": 72,
        "risk_category": "high",
        "incident_count": 5
      }
    ]
  }
}
```

## Compare Ports

Compares safety and risk information for multiple ports.

```
GET /ports/compare
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ports` | string | Yes | Comma-separated list of port IDs to compare (max: 5) |

### Response

```json
{
  "data": {
    "ports": [
      {
        "id": "NGLOS",
        "name": "Lagos",
        "country": "NG",
        "risk_index": 72,
        "risk_category": "high",
        "incident_count_30d": 5,
        "risk_factors": {
          "piracy": 75,
          "armed_robbery": 70,
          "theft": 65,
          "stowaways": 60,
          "corruption": 65
        }
      },
      {
        "id": "MYPKG",
        "name": "Port Klang",
        "country": "MY",
        "risk_index": 28,
        "risk_category": "low",
        "incident_count_30d": 1,
        "risk_factors": {
          "piracy": 25,
          "armed_robbery": 20,
          "theft": 35,
          "stowaways": 15,
          "corruption": 30
        }
      }
    ],
    "comparison": {
      "risk_index_diff": 44,
      "incident_count_diff": 4,
      "risk_factors_diff": {
        "piracy": 50,
        "armed_robbery": 50,
        "theft": 30,
        "stowaways": 45,
        "corruption": 35
      }
    }
  }
}
```
