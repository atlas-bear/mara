# Flash Report System

The Flash Report system is a critical component of our maritime risk monitoring platform, designed to rapidly disseminate incident alerts to stakeholders via email when maritime security incidents occur.

## Purpose

Flash Reports provide immediate notification of maritime security incidents, allowing stakeholders to:

- Receive timely alerts about incidents affecting vessels or regions of interest
- Get detailed incident information including vessel data, location, and incident type
- Access analysis and recommendations for responding to the incident
- View geographic context through embedded location maps

## Key Features

- **Real-time Alerts**: Sends notifications as soon as incidents are reported
- **Comprehensive Information**: Includes vessel details, incident description, location, and analysis
- **Visual Context**: Embedded map showing the precise incident location
- **MARA Branded Emails**: Consistent MARA branding in all emails for unified experience
- **Customizable Web View**: Client-specific branding for online report views based on email domain
- **Robust Vessel Data**: Multiple lookup strategies to ensure complete vessel information
- **Extended Link Validity**: Public links remain valid for 1 year
- **Secure Delivery**: All communication handled through secure serverless functions
- **Testing Mode**: Built-in functionality to test the flash report system without sending actual emails

## Technical Implementation

The Flash Report system is implemented as a Netlify serverless function (`send-flash-report.js`) that securely handles the API keys and email delivery logic. It uses SendGrid for email delivery and Mapbox for generating static location maps.

## Related Documentation

- [Flash Report API Reference](./api-reference.md)
- [Integration Guide](./integration-guide.md)
- [Testing Guide](./testing-guide.md)