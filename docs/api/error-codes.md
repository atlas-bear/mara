# API Error Codes

The MARA API uses standard HTTP status codes to indicate the success or failure of requests. This page documents the specific error codes and messages you might encounter, along with suggested solutions.

## HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request succeeded |
| 201 | Created - The resource was successfully created |
| 400 | Bad Request - The request could not be understood or was missing required parameters |
| 401 | Unauthorized - Authentication failed or user doesn't have permissions |
| 403 | Forbidden - Access to the requested resource is forbidden |
| 404 | Not Found - The requested resource could not be found |
| 405 | Method Not Allowed - The HTTP method is not supported for this resource |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Something went wrong on the server |
| 503 | Service Unavailable - The service is temporarily unavailable |

## Error Response Format

When an error occurs, the API returns a JSON response with details about the error:

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "The parameter 'start_date' is invalid. Date must be in YYYY-MM-DD format.",
    "details": {
      "parameter": "start_date",
      "provided": "2023/09/15",
      "expected": "YYYY-MM-DD"
    },
    "request_id": "req_7a9c48ef23b1",
    "documentation_url": "https://api.atlas-bear.com/mara/docs/api/error-codes"
  }
}
```

## Common Error Codes

### Authentication Errors (401, 403)

| Error Code | Description | Solution |
|------------|-------------|----------|
| `missing_auth` | API key is missing | Include the API key in the Authorization header |
| `invalid_api_key` | API key is invalid or revoked | Check your API key or request a new one |
| `expired_api_key` | API key has expired | Renew your API key |
| `insufficient_permissions` | Your API key doesn't have permission for this operation | Request elevated permissions or use a different key |

### Request Errors (400)

| Error Code | Description | Solution |
|------------|-------------|----------|
| `invalid_parameter` | One or more parameters are invalid | Check the error details for specific parameter issues |
| `missing_parameter` | A required parameter is missing | Ensure all required parameters are included |
| `invalid_json` | Request body contains invalid JSON | Verify your JSON syntax |
| `unsupported_format` | Requested data format is not supported | Check the documentation for supported formats |
| `invalid_date_range` | The provided date range is invalid | Ensure start_date is before end_date and both are valid |
| `invalid_coordinates` | The provided coordinates are invalid | Verify the coordinates are in the correct format and range |

### Resource Errors (404)

| Error Code | Description | Solution |
|------------|-------------|----------|
| `resource_not_found` | The requested resource doesn't exist | Verify the resource ID |
| `endpoint_not_found` | The requested API endpoint doesn't exist | Check the API documentation for valid endpoints |
| `version_not_found` | The requested API version doesn't exist | Use a supported API version |

### Rate Limiting Errors (429)

| Error Code | Description | Solution |
|------------|-------------|----------|
| `rate_limit_exceeded` | You've exceeded your rate limit | Slow down your request rate or upgrade your subscription |
| `daily_quota_exceeded` | You've exceeded your daily request quota | Wait for the quota to reset or upgrade your subscription |

### Server Errors (500, 503)

| Error Code | Description | Solution |
|------------|-------------|----------|
| `internal_error` | An unexpected error occurred | Contact support with the request_id |
| `service_unavailable` | The service is temporarily unavailable | Try again later |
| `maintenance_mode` | The API is in maintenance mode | Try again later |

## Error Handling Best Practices

1. **Always check HTTP status codes** in your API client
2. **Implement exponential backoff** when encountering rate limits (429)
3. **Log request_id values** for easier troubleshooting with support
4. **Display user-friendly error messages** based on the returned error code
5. **For temporary errors** (429, 503), implement automatic retries with backoff

## Contacting Support

If you encounter persistent errors that you cannot resolve, please contact our support team and include:

1. The full error response including the request_id
2. The API endpoint you were trying to access
3. The request parameters you used (without sensitive data)
4. Any other relevant information

Contact support at [api-support@atlas-bear.com](mailto:api-support@atlas-bear.com).