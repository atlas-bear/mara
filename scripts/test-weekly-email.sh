#!/bin/bash

# This script sends a test request to the weekly report notification test function
# Usage: ./test-weekly-email.sh [NETLIFY_URL] [TEST_EMAIL] [SEND_CLIENT_VERSION]

# Get the Netlify URL from command line or use default
NETLIFY_URL=${1:-"https://your-netlify-url.netlify.app"}

# Get test email from command line or use default
TEST_EMAIL=${2:-"your-email@example.com"}

# Get whether to send client version - defaults to true
SEND_CLIENT_VERSION=${3:-"true"}

echo "Sending test to: $NETLIFY_URL"
echo "Test email will be sent to: $TEST_EMAIL"
echo "Including client domain example in response: YES"
echo "Sending client version email: $SEND_CLIENT_VERSION"

# Send the request to the test function specifically made for testing
curl -X POST "$NETLIFY_URL/.netlify/functions/test-weekly-notification" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\": \"$TEST_EMAIL\", \"includeClientExample\": true, \"sendClientVersion\": $SEND_CLIENT_VERSION}"

echo ""
echo "Request sent. Check the Netlify logs for details."