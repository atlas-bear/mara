#!/bin/bash

# This script sends a test request to the weekly report notification function
# Usage: ./test-weekly-email.sh [NETLIFY_URL] [TEST_EMAIL]

# Get the Netlify URL from command line or use default
NETLIFY_URL=${1:-"https://your-netlify-url.netlify.app"}

# Get test email from command line or use default
TEST_EMAIL=${2:-"your-email@example.com"}

echo "Sending test to: $NETLIFY_URL"
echo "Test email will be sent to: $TEST_EMAIL"
echo "Including client domain example: YES"

# Send the request
curl -X POST "$NETLIFY_URL/.netlify/functions/send-weekly-report-notification" \
  -H "Content-Type: application/json" \
  -d "{\"testMode\": true, \"testEmail\": \"$TEST_EMAIL\", \"includeClientExample\": true}"

echo ""
echo "Request sent. Check the Netlify logs for details."