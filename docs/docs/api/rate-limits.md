---
id: rate-limits
title: API Rate Limits
sidebar_label: Rate Limits
---

# API Rate Limits

To ensure service stability and fair usage, the MARA API enforces rate limits on requests. This page explains how these limits work, how to track your usage, and what to do when you reach a limit.

## Rate Limit Tiers

Rate limits are based on your subscription tier:

| Tier | Requests per Minute | Requests per Day | Burst Capacity |
|------|---------------------|------------------|----------------|
| Basic | 30 | 2,000 | 50 |
| Standard | 60 | 5,000 | 100 |
| Premium | 120 | 10,000 | 200 |
| Enterprise | Custom | Custom | Custom |

- **Requests per Minute**: The maximum number of requests allowed in any 60-second window
- **Requests per Day**: The maximum number of requests allowed in a 24-hour period (UTC)
- **Burst Capacity**: The maximum number of requests allowed in a short burst (typically 10 seconds)

## Rate Limit Headers

Every API response includes headers that provide information about your current rate limit status:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1632506892
X-Daily-RateLimit-Limit: 5000
X-Daily-RateLimit-Remaining: 4320
X-Daily-RateLimit-Reset: 1632571200
```

- **X-RateLimit-Limit**: Your per-minute request limit
- **X-RateLimit-Remaining**: The number of requests remaining in the current minute window
- **X-RateLimit-Reset**: The time at which the per-minute limit resets (Unix timestamp)
- **X-Daily-RateLimit-Limit**: Your daily request limit
- **X-Daily-RateLimit-Remaining**: The number of requests remaining in the current day
- **X-Daily-RateLimit-Reset**: The time at which the daily limit resets (Unix timestamp)

## Handling Rate Limit Errors

When you exceed a rate limit, the API returns a `429 Too Many Requests` response with details about the limit exceeded:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "You have exceeded the rate limit of 60 requests per minute",
    "details": {
      "limit": 60,
      "remaining": 0,
      "reset": 1632506892
    },
    "request_id": "req_7a9c48ef23b1",
    "documentation_url": "https://api.atlas-bear.com/mara/docs/api/rate-limits"
  }
}
```

### Best Practices for Handling Rate Limits

1. **Monitor the rate limit headers** to track your usage
2. **Implement exponential backoff** when receiving 429 responses:
   - Start with a small delay (e.g., 1 second)
   - Double the delay on each retry
   - Add some randomness to prevent synchronized retries
   - Set a maximum retry limit

### Sample Backoff Algorithm (Python)

```python
import time
import random
import requests

def make_api_request_with_backoff(url, headers, max_retries=5):
    retries = 0
    base_delay = 1  # Base delay in seconds

    while retries < max_retries:
        response = requests.get(url, headers=headers)
        
        if response.status_code != 429:  # Not rate limited
            return response
            
        # Extract reset time from headers or use exponential backoff
        reset_time = int(response.headers.get('X-RateLimit-Reset', 0))
        current_time = time.time()
        
        if reset_time > current_time:
            # Wait until the rate limit resets
            delay = reset_time - current_time + random.uniform(0.1, 1.0)
        else:
            # Use exponential backoff
            delay = (2 ** retries) * base_delay + random.uniform(0.1, 1.0)
        
        print(f"Rate limited. Retrying in {delay:.2f} seconds...")
        time.sleep(delay)
        retries += 1
    
    raise Exception("Maximum retries reached due to rate limiting")
```

## Strategies to Optimize Request Usage

1. **Batch operations** when possible instead of making many small requests
2. **Cache responses** for data that doesn't change frequently
3. **Implement conditional requests** using ETags and If-Modified-Since headers
4. **Distribute requests evenly** over time rather than sending in bursts
5. **Prioritize critical requests** over less important ones

## Monitoring Your Usage

You can monitor your API usage through:

1. **The Atlas Bear Portal dashboard**, which provides real-time and historical usage metrics
2. **Rate limit headers** in API responses
3. **Email notifications** when you approach your daily limits (configurable in your account settings)

## Increasing Your Rate Limits

If you regularly exceed your rate limits, consider:

1. **Upgrading your subscription tier** for higher limits
2. **Optimizing your API usage** using the strategies mentioned above
3. **Contacting our support team** for a custom enterprise plan if you have specific high-volume needs

To upgrade your plan, visit the [Atlas Bear Portal](https://portal.atlas-bear.com) or contact our [sales team](mailto:sales@atlas-bear.com).

## Exemptions

Certain endpoints have different rate limits or are exempt from standard limits:

| Endpoint | Special Limit Condition |
|----------|-------------------------|
| `/healthcheck` | Not rate-limited |
| `/authentication/verify` | Limited to 300 requests per hour per API key |
| Webhook delivery | Not counted against your rate limits |

## Testing Rate Limits

For testing how your application handles rate limits, you can use the test endpoint:

```
GET /test/rate-limit
```

This endpoint always returns a 429 response with standard rate limit headers, allowing you to test your backoff and retry logic.
