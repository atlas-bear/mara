# Data Collection System

The MARA data collection system automatically gathers maritime incident information from multiple authoritative sources and standardizes it for further processing. Each source has a dedicated collection function tailored to that source's specific data format and access methods.

## Collection Functions

MARA implements the following collection functions, each designed to interface with a specific maritime reporting organization:

| Function | Source | Data Access | Update Frequency |
|----------|--------|-------------|------------------|
| `collect-recaap.js` | ReCAAP | API | Twice hourly |
| `collect-ukmto.js` | UKMTO | Website scraping | Twice hourly |
| `collect-mdat.js` | MDAT-GoG | API | Twice hourly |
| `collect-icc.js` | ICC-IMB | API | Twice hourly |
| `collect-cwd.js` | CWD | API | Twice hourly |

## Common Collection Pattern

While each source has unique requirements, all collection functions follow a common pattern:

1. **Authentication**: Establish secure connection to the source
2. **Data Retrieval**: Fetch recent incident data
3. **Deduplication**: Check if incidents already exist in the `raw_data` table
4. **Standardization**: Convert source-specific fields to a common format
5. **Storage**: Save new incidents to the `raw_data` table in Airtable
6. **Logging**: Record collection activity for monitoring

## Source-Specific Implementations

### ReCAAP Collection (`collect-recaap.js`)

The Regional Cooperation Agreement on Combating Piracy and Armed Robbery against Ships in Asia (ReCAAP) provides detailed incident reports with vessel information.

**Data Access**:
- Uses the ReCAAP API endpoint
- Authenticates using API key
- Retrieves incidents in JSON format

**Key Features**:
- Comprehensive vessel data (name, type, flag, IMO)
- Detailed incident descriptions
- Standardized categorization system (CAT1-CAT4)
- Geographic focus on Asian waters

### UKMTO Collection (`collect-ukmto.js`)

UK Maritime Trade Operations (UKMTO) provides maritime security information focused on the Arabian Gulf, Gulf of Aden, and Western Indian Ocean.

**Data Access**:
- Accesses UKMTO's public data feed
- Parses structured data
- Filters for relevant maritime security incidents

**Key Features**:
- Focus on Red Sea, Gulf of Aden, and Indian Ocean
- Strong coverage of security threats and warnings
- Timely naval forces reporting
- Minimal vessel details

### MDAT-GoG Collection (`collect-mdat.js`)

Maritime Domain Awareness for Trade - Gulf of Guinea (MDAT-GoG) specializes in West African maritime security incidents.

**Data Access**:
- Uses MDAT-GoG's REST API
- Retrieves incident details in structured format
- Focuses on West Africa region

**Key Features**:
- Specialized coverage of Gulf of Guinea incidents
- Detailed attack methodologies
- Strong naval response information
- Limited vessel details

### ICC-IMB Collection (`collect-icc.js`)

International Chamber of Commerce - International Maritime Bureau (ICC-IMB) provides global piracy and armed robbery reporting.

**Data Access**:
- Accesses ICC's piracy reporting center data
- Extracts incident data from structured feeds
- Global incident coverage

**Key Features**:
- Worldwide incident coverage
- Focus on commercial shipping impacts
- Standardized incident categorization
- Variable level of detail in incident descriptions

### CWD Collection (`collect-cwd.js`)

Commercial Wisdom Database (CWD) provides supplementary incident data from commercial sources.

**Data Access**:
- Uses proprietary API access
- Structured data retrieval
- Requires special authentication

**Key Features**:
- Commercially sourced intelligence
- Detailed impact on shipping operations
- Economic context for incidents
- Additional analytical metadata

## Data Standardization

Each collection function standardizes the source data into a common format with these key fields:

**Required Fields**:
- `title`: Brief incident description
- `description`: Detailed incident narrative
- `date`: ISO-8601 formatted incident timestamp
- `reference`: Unique source reference ID
- `source`: Name of the reporting organization
- `original_source`: Original reporter (if different from source)

**Location Information**:
- `latitude`: Decimal degrees
- `longitude`: Decimal degrees
- `region`: Standardized maritime region
- `location`: Textual description of location

**Incident Details**:
- `incident_type_name`: Categorization of incident type
- `incident_type_level`: Severity or threat level

**Vessel Information** (when available):
- `vessel_name`: Ship name
- `vessel_type`: Vessel category
- `vessel_flag`: Flag state
- `vessel_imo`: IMO identification number
- `vessel_status`: Operational status during incident

**Metadata**:
- `created_at`: Collection timestamp
- `modified_at`: Last update timestamp
- `raw_json`: Original source data preserved as JSON

## Error Handling and Resilience

The collection functions implement robust error handling to ensure reliability:

1. **Connection Failures**: Graceful handling of API timeouts or unavailability
2. **Rate Limiting**: Respects source API rate limits with exponential backoff
3. **Partial Data**: Processes available data even if some fields are missing
4. **Schema Changes**: Adapts to minor changes in source data schema
5. **Logging**: Detailed error logging for troubleshooting

## Monitoring and Maintenance

Collection activity is monitored through:

1. **Function Logs**: Detailed execution logs in Netlify
2. **Activity Tracking**: Collection runs recorded in the `monitor_runs` table
3. **Error Alerting**: Critical failures trigger notifications
4. **Health Checks**: Regular validation of source connectivity

## Extending for New Sources

To add a new maritime incident source:

1. Create a new collection function using the existing functions as templates
2. Implement source-specific authentication and data extraction
3. Map source fields to the standard MARA data schema
4. Add deduplication logic to prevent duplicate entries
5. Schedule the new function in `netlify.toml`
6. Update monitoring to include the new source

## Scheduled Operation

Collection functions are scheduled in a staggered pattern to prevent resource contention:

```toml
[functions."collect-recaap"]
schedule = "0,30 * * * *"  # On the hour and half-hour

[functions."collect-ukmto"]
schedule = "5,35 * * * *"  # 5 and 35 minutes past the hour

[functions."collect-mdat"]
schedule = "15,45 * * * *" # 15 and 45 minutes past the hour

[functions."collect-icc"]
schedule = "20,50 * * * *" # 20 and 50 minutes past the hour
```

This ensures regular data collection while distributing the processing load.