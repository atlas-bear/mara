---
id: overview
title: API Overview
sidebar_label: Overview
---

# MARA API Overview

The MARA API provides programmatic access to MARA's security incident data, intelligence reports, hotspots, and indices for countries and ports. This document provides an overview of the API design, usage patterns, and available resources.

## Base URL

All API requests should be made to the following base URL:

```
https://api.atlas-bear.com/mara/v1
```

## Authentication

The MARA API uses API keys for authentication. Include your API key in the request header:

```bash
Authorization: Bearer YOUR_API_KEY
```

See the [Authentication](authentication) section for more details on obtaining and using API keys.

## Data Format

The API accepts and returns data in JSON format. Make sure to include the appropriate header in your requests:

```
Content-Type: application/json
```

## Available Resources

The MARA API provides access to the following resources:

- **Incidents**: Access to security incident data
- **Reports**: Intelligence reports for specific regions or topics
- **Hotspots**: Daily security hotspot information
- **Countries**: Country risk index and related information
- **Ports**: Port safety index and related information

## Rate Limits

To ensure service stability, the API enforces rate limits on requests. See the [Rate Limits](rate-limits) section for details.

## Pagination

For endpoints that return collections of resources, the API supports pagination using `limit` and `offset` parameters:

```
GET /incidents?limit=10&offset=0
```

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of requests. See the [Error Codes](error-codes) section for more information on error responses.
