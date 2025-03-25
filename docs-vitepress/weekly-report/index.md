# Weekly Report

The Weekly Report is a comprehensive maritime security feature that provides a structured view of maritime incidents over a 7-day reporting period. This documentation covers the implementation, architecture, and key components of the Weekly Report system.

## Overview

The Weekly Report provides a structured summary of maritime security incidents within a standard reporting period of Monday 21:00 UTC to Monday 21:00 UTC. It includes:

- Executive Brief with global threat overview
- Key development highlights generated with AI
- 7-day forecast for regional maritime security
- Regional breakdown of incidents
- Detailed incident reports

## Key Features

- **Standardized Reporting Period:** Consistent Monday 21:00 UTC to Monday 21:00 UTC reporting cycle
- **AI-Generated Insights:** Key developments and forecasts generated using Claude AI
- **Regional Analysis:** Breakdown of incidents by region with threat levels
- **Interactive Map:** Visualization of incident locations
- **Efficient Caching:** Seven-day caching of report content
- **Multi-Tenant Support:** White-labeled reports for branded client applications
- **PDF Export:** Capability to generate PDF versions of reports

## Components

The Weekly Report consists of several key components:

1. **ExecutiveBrief:** Top-level overview component showing global threat levels, key developments, and forecast
2. **RegionalBrief:** Region-specific analysis with incidents map and threat assessment
3. **IncidentDetails:** Detailed information about specific maritime incidents

## Architecture

The Weekly Report system uses a tiered architecture:

1. **Client-Side Components:** React components for viewing the report
2. **Serverless Functions:** Backend processing for data retrieval and AI analysis
3. **Background Jobs:** Scheduled functions for report generation
4. **Caching Layer:** Seven-day cache for optimal performance

## Implementation

See the [Implementation Guide](./implementation.md) for detailed information on how the Weekly Report is built.

## Date Handling

See the [Date Handling Guide](./date-handling.md) for information on how the Weekly Report handles the standardized reporting period.

## Data Flow

See the [Data Flow Documentation](./data-flow.md) for details on how data moves through the Weekly Report system.

## API Reference

See the [API Reference](./api-reference.md) for the endpoints used by the Weekly Report system.