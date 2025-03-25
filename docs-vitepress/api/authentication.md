# Authentication

The MARA API uses API keys to authenticate requests. To access the API, you'll need to obtain an API key from Atlas Bear.

## Obtaining an API Key

To request an API key:

1. Create an account on the [Atlas Bear Portal](https://portal.atlas-bear.com)
2. Navigate to the API section
3. Follow the instructions to request an API key
4. After approval, your API key will be available in your account

## Using Your API Key

Include your API key in the `Authorization` header of all requests:

```bash
Authorization: Bearer YOUR_API_KEY
```

Example request using cURL:

```bash
curl -X GET "https://api.atlas-bear.com/mara/v1/incidents" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json"
```

## API Key Security

Treat your API key like a password:

- Never share your API key publicly
- Do not include it in client-side code
- Store it securely in your backend systems
- Use environment variables or secure vaults
- Rotate your keys periodically

If you believe your API key has been compromised, immediately regenerate a new key through the Atlas Bear Portal.

## Access Levels

API keys are assigned specific access levels:

| Level | Description |
|-------|-------------|
| Basic | Read-only access to public data |
| Standard | Read-only access to all data |
| Premium | Read-write access to all data |

Your access level determines which endpoints and operations are available to you.

## Rate Limiting

API requests are rate-limited based on your subscription tier. See the [Rate Limits](./rate-limits) page for details on limits and how to handle rate limit responses.