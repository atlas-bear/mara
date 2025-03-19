---
id: changelog
title: API Changelog
sidebar_label: Changelog
---

# API Changelog

This page documents the changes and updates to the MARA API. We recommend regularly checking this page to stay informed about new features, breaking changes, and deprecations.

## 2023-09-15: v1.2.0

### Added
- New endpoint: `/hotspots/map` for retrieving geospatial data for active hotspots
- Added `classification` field to reports to indicate access level
- Added support for GeoJSON format in multiple endpoints
- Added `tags` field to incidents for improved categorization

### Changed
- Enhanced risk assessment algorithm for more accurate risk indices
- Improved search capabilities for all list endpoints
- Updated rate limits for Premium tier subscribers

### Fixed
- Fixed an issue where some incident coordinates were not correctly formatted
- Resolved a bug in the reports filtering system
- Fixed pagination issues in the `/countries` endpoint

## 2023-07-02: v1.1.1

### Fixed
- Fixed a critical bug in the authentication system
- Resolved performance issues with the `/incidents/analysis` endpoint
- Fixed incorrect date formatting in some responses

## 2023-06-15: v1.1.0

### Added
- New endpoint: `/ports/compare` for comparing multiple ports
- Added `risk_factors` detail to country and port responses
- Added support for filtering incidents by severity
- Implemented conditional requests using ETags

### Changed
- Enhanced detailed incident responses with more comprehensive data
- Improved error messages for better troubleshooting
- Updated the rate limiting algorithm to better handle burst requests

### Deprecated
- The `region_code` parameter is deprecated in favor of `region`
- The legacy format for incident coordinates will be removed in v1.2.0

## 2023-04-10: v1.0.1

### Fixed
- Fixed inconsistent timestamp formats across endpoints
- Resolved an issue with the `/incidents` endpoint pagination
- Fixed a bug in the filtering system for the `/reports` endpoint

## 2023-03-01: v1.0.0

### Added
- Initial release of the MARA API
- Core endpoints for incidents, reports, hotspots, countries, and ports
- Basic search and filtering capabilities
- Authentication using API keys
- Rate limiting system
- Comprehensive error handling

## API Versioning Policy

The MARA API uses semantic versioning (MAJOR.MINOR.PATCH) for its release numbering:

- **MAJOR** version increments indicate incompatible API changes
- **MINOR** version increments add functionality in a backward-compatible manner
- **PATCH** version increments include backward-compatible bug fixes

### Version Compatibility

We maintain backward compatibility within a major version. When we need to make breaking changes, we:

1. Release a new major version
2. Provide a migration guide
3. Maintain the previous version for at least 6 months

### Deprecation Process

1. Features are first marked as deprecated in the documentation
2. Deprecated features remain functional for at least 3 months
3. We send notifications about upcoming removals to active API users
4. Deprecated features are removed only in a new major version release

## Release Schedule

- **Security patches**: Released as needed
- **Bug fixes**: Released approximately monthly
- **Minor releases**: Typically every 3 months
- **Major releases**: Scheduled annually with at least 6 months notice

## Beta Features

Some endpoints or parameters may be marked as "Beta" in the documentation. These are available for testing but:

- May change without notice
- Are not covered by our normal versioning policy
- May have different reliability or performance characteristics
- Should not be used in production applications without caution

## Staying Updated

We recommend subscribing to our API updates through one of these channels:

- [API Status and Updates Page](https://status.atlas-bear.com/api)
- API Updates mailing list (configure in the Atlas Bear Portal)
- [MARA API on Twitter](https://twitter.com/mara_api)
