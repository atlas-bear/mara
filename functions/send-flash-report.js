import sgMail from '@sendgrid/mail';
import axios from 'axios';
import { getIncident } from './utils/incident-utils.js';
import { getVesselByIMO } from './utils/vessel-utils.js';
import { validateData } from './utils/validation.js';
import { corsHeaders } from './utils/environment.js';
import { generateFlashReportToken, getPublicFlashReportUrl } from './utils/token-utils.js';

/**
 * Netlify function to send flash reports via SendGrid
 * This handles the email sending functionality, keeping API keys secure
 * and avoiding CORS issues
 */
export const handler = async (event, context) => {
  // Check for allowed request methods
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' }),
    };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Configure SendGrid (check for VITE_ prefixed variables too)
    const apiKey = process.env.SENDGRID_API_KEY || process.env.VITE_SENDGRID_API_KEY;
    sgMail.setApiKey(apiKey);
    console.log('SendGrid API configured with key length:', apiKey ? apiKey.length : 'not found');
    
    // Parse request body and log for debugging
    console.log('Request body:', event.body);
    const payload = JSON.parse(event.body);
    console.log('Parsed payload:', JSON.stringify(payload));
    
    // Validate required fields
    const requiredFields = ['incidentId', 'recipients'];
    const validation = validateData(payload, requiredFields);
    
    if (!validation.valid) {
      console.log('Validation failed:', validation.error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: validation.error }),
      };
    }

    const { incidentId, recipients, customBranding, templateOverrides, testMode } = payload;
    console.log('Processing flash report. Test mode:', testMode ? 'YES' : 'NO');
    console.log('Processing request for incident ID:', incidentId);
    
    // Fetch incident data from Airtable or use sample data for testing
    let incidentData;
    
    // For testing purposes - this is a sample incident to use when Airtable is not available
    // or when testing with sample data
    const sampleIncidentData = {
      id: '2025-0010',
      incident_type: 'Robbery',
      date_time_utc: '2024-10-17T18:08:00.000Z',
      location_name: 'Singapore Strait',
      latitude: '1.13',
      longitude: '103.5',
      vessel_name: 'ASPASIA LUCK',
      vessel_type: 'Bulk Carrier',
      vessel_flag: 'Liberia',
      vessel_imo: '9223485',
      vessel_status_during_incident: 'Underway',
      vessel_destination: 'PEBGB',
      crew_impact: 'All Safe',
      description: 'Test incident description for flash report from serverless function.',
      response_type: ['Action 1', 'Action 2'],
      authorities_notified: ['Local Maritime Authority'],
      items_stolen: ['Ship supplies'],
      analysis: 'This is a sample analysis for testing the flash report email functionality.',
      recommendations: 'Use caution when transiting this area.'
    };

    try {
      // Try to get real incident data first
      try {
        console.log('Attempting to fetch incident from Airtable...');
        incidentData = await getIncident(incidentId);
        console.log('Airtable fetch result:', incidentData ? 'Found' : 'Not found');
      } catch (airtableError) {
        console.warn('Could not fetch from Airtable:', airtableError.message);
        console.log('Sample incident ID check:', incidentId, 'Matches?', incidentId === '2025-0010');
        
        // If Airtable fetch fails and this is the sample incident ID, use sample data
        if (incidentId === '2025-0010') {
          console.log('Using sample incident data instead');
          incidentData = sampleIncidentData;
        }
      }
      
      // If we still don't have incident data, return an error
      if (!incidentData) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Incident with ID ${incidentId} not found` }),
        };
      }
    } catch (error) {
      console.error('Error handling incident data:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Error fetching incident data' }),
      };
    }
    
    // Get vessel data if available
    let vesselData = {};
    if (incidentData.vessel_imo) {
      try {
        // First try to fetch from Airtable
        vesselData = await getVesselByIMO(incidentData.vessel_imo);
      } catch (error) {
        console.error('Error fetching vessel data:', error);
        // If this is the sample incident, use sample vessel data
        if (incidentId === '2024-2662') {
          vesselData = {
            name: incidentData.vessel_name,
            type: incidentData.vessel_type,
            flag: incidentData.vessel_flag,
            imo: incidentData.vessel_imo
          };
        }
        // For other incidents, continue without vessel data
      }
    }
    
    // Generate static map
    let mapImageUrl = '';
    try {
      if (incidentData.latitude && incidentData.longitude) {
        // Generate a MapBox Static API URL (check for VITE_ prefix)
        const mapboxToken = process.env.MAPBOX_TOKEN || process.env.VITE_MAPS_API_KEY;
        
        if (!mapboxToken) {
          console.warn('MapBox token not found in environment variables');
          console.log('Looked for: MAPBOX_TOKEN or VITE_MAPS_API_KEY');
          // Use a placeholder image if no token is available
          mapImageUrl = 'https://placehold.co/600x400?text=Map+Location';
        } else {
          console.log('Using MapBox token (length):', mapboxToken.length);
          // Define marker appearance based on incident type
          const incident_type = incidentData.incident_type || 'unknown';
          const markerColor = getMarkerColorByType(incident_type.toLowerCase());
          
          // Create a marker for the incident location
          const marker = `pin-l+${markerColor.replace('#', '')}(${incidentData.longitude},${incidentData.latitude})`;
          
          // Define map style - using satellite by default
          const mapStyle = 'mapbox/satellite-v9';
          
          // Build URL
          mapImageUrl = `https://api.mapbox.com/styles/v1/${mapStyle}/static/${marker}/${incidentData.longitude},${incidentData.latitude},5,0/600x400@2x?access_token=${mapboxToken}`;
        }
      } else {
        console.warn('No coordinates available for map generation');
        mapImageUrl = 'https://placehold.co/600x400?text=No+Coordinates';
      }
    } catch (mapError) {
      console.error('Error generating map image:', mapError);
      // Use a fallback for errors
      mapImageUrl = 'https://placehold.co/600x400?text=Map+Error';
    }
    
    // Prepare incident data for email
    const preparedIncident = {
      id: incidentData.id,
      type: incidentData.incident_type,
      date: incidentData.date_time_utc,
      location: incidentData.location_name,
      coordinates: {
        latitude: parseFloat(incidentData.latitude) || 0,
        longitude: parseFloat(incidentData.longitude) || 0
      },
      vesselName: vesselData.name || incidentData.vessel_name,
      vesselType: vesselData.type || incidentData.vessel_type,
      vesselFlag: vesselData.flag || incidentData.vessel_flag,
      vesselIMO: vesselData.imo || incidentData.vessel_imo,
      status: incidentData.vessel_status_during_incident || 'Unknown',
      destination: incidentData.vessel_destination || '',
      crewStatus: incidentData.crew_impact || 'No information available',
      description: incidentData.description,
      responseActions: incidentData.response_type || [],
      authorities_notified: incidentData.authorities_notified || [],
      items_stolen: incidentData.items_stolen || [],
      analysis: incidentData.analysis || 'No analysis available',
      recommendations: incidentData.recommendations || '',
      mapImageUrl
    };
    
    // If test mode is enabled, always generate tokens and return URLs
    if (testMode) {
      console.log('TEST MODE ENABLED: Will generate tokens and URLs but skip actual email sending');
      
      // Generate tokens and URLs for testing
      const testResults = await Promise.all(recipients.map(async (recipient) => {
        // Generate a secure token for testing
        const tokenData = generateFlashReportToken(incidentId, 168);
        
        // Get brand parameter for the URL if this is a client
        const brandParam = recipient.isClient ? 'client' : null;
        
        // Generate public flash report URL
        const publicUrl = getPublicFlashReportUrl(incidentId, tokenData.token, brandParam);
        
        return {
          email: recipient.email,
          status: 'test-mode',
          token: tokenData.token,
          publicUrl: publicUrl
        };
      }));
      
      // Log public URLs for testing
      console.log('TEST MODE: Public URLs generated:');
      testResults.forEach(r => {
        console.log(`- ${r.email}: ${r.publicUrl}`);
      });
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Flash report test completed (no emails sent)',
          testMode: true,
          results: testResults
        })
      };
    }
    
    // Look for SendGrid API key with or without VITE_ prefix
    const sendGridApiKey = process.env.SENDGRID_API_KEY || process.env.VITE_SENDGRID_API_KEY;
    const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.VITE_SENDGRID_FROM_EMAIL;
    
    // Check if SendGrid API key is available
    if (!sendGridApiKey) {
      console.warn('SendGrid API key not found in environment variables');
      console.log('Environment variables available:', Object.keys(process.env).filter(key => !key.includes('SECRET')).join(', '));
      console.log('Looking for: SENDGRID_API_KEY or VITE_SENDGRID_API_KEY');
      
      // Generate tokens and URLs for testing even without SendGrid
      const testResults = await Promise.all(recipients.map(async (recipient) => {
        // Generate a secure token for testing
        const tokenData = generateFlashReportToken(incidentId, 168);
        
        // Get brand parameter for the URL if this is a client
        const brandParam = recipient.isClient ? 'client' : null;
        
        // Generate public flash report URL
        const publicUrl = getPublicFlashReportUrl(incidentId, tokenData.token, brandParam);
        
        return {
          email: recipient.email,
          status: 'demo-would-send',
          token: tokenData.token,
          publicUrl: publicUrl
        };
      }));
      
      // Log detailed information about what would happen
      console.log('TESTING MODE: Would send emails to:', recipients.map(r => r.email).join(', '));
      console.log('Public URLs generated:', testResults.map(r => `${r.email}: ${r.publicUrl}`).join('\n'));
      
      // For testing without sending emails
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'TESTING MODE: Email would be sent (no SendGrid API key provided)',
          incident: preparedIncident,
          recipients: recipients.map(r => r.email),
          mapImageUrl: mapImageUrl || 'No map generated',
          results: testResults
        })
      };
    }
    
    // Send emails (if SendGrid API key is available)
    const results = await Promise.all(recipients.map(async (recipient) => {
      try {
        // Get branding for this recipient
        const branding = getBrandingForEmail(recipient.email, customBranding);
        
        // Generate a secure token for this recipient
        const tokenData = generateFlashReportToken(incidentId, 168); // 7 days expiry
        
        // Get brand parameter for the URL if this is a client
        const brandParam = recipient.isClient ? 'client' : null;
        
        // Generate public flash report URL
        const publicUrl = getPublicFlashReportUrl(incidentId, tokenData.token, brandParam);
        
        // Create email subject
        const subject = `🚨 MARITIME ALERT: ${preparedIncident.vesselName} Incident`;
        
        // Create HTML content with public link
        const htmlContent = await generateEmailHtml(
          preparedIncident, 
          branding, 
          templateOverrides, 
          publicUrl // Pass public URL to the template
        );
        
        // Create email object
        const emailData = {
          to: recipient.email,
          from: {
            email: sendGridFromEmail || process.env.VITE_SENDGRID_FROM_EMAIL || 'alerts@example.com',
            name: branding.companyName || 'Maritime Risk Analysis'
          },
          subject,
          html: htmlContent,
          categories: ['flash-report', 'maritime', 'incident'],
          customArgs: {
            incident_id: incidentId,
            token: tokenData.token // Include token for tracking
          }
        };
        
        try {
          // Log email sending attempt
          console.log(`Attempting to send email to ${recipient.email} with SendGrid...`);
          console.log(`From: ${emailData.from.email} (${emailData.from.name})`);
          console.log(`To: ${emailData.to}`);
          console.log(`Subject: ${emailData.subject}`);
          console.log(`Public URL in email: ${publicUrl}`);
          
          // Send email
          await sgMail.send(emailData);
          
          console.log(`Email successfully sent to ${recipient.email}`);
          
          return {
            email: recipient.email,
            status: 'sent',
            publicUrl: publicUrl
          };
        } catch (sendGridError) {
          console.error(`SendGrid error for ${recipient.email}:`, sendGridError);
          // Log more detailed error information
          if (sendGridError.response) {
            console.error('SendGrid API response:', JSON.stringify({
              statusCode: sendGridError.code || sendGridError.response.statusCode,
              body: sendGridError.response.body,
              headers: sendGridError.response.headers
            }));
          }
          
          return {
            email: recipient.email,
            status: 'failed',
            error: sendGridError.message,
            publicUrl: publicUrl // Still return the URL even if email fails
          };
        }
      } catch (error) {
        console.error(`Error preparing email for ${recipient.email}:`, error);
        
        // Try to generate a public URL even if there was an error
        try {
          const tokenData = generateFlashReportToken(incidentId, 168);
          const brandParam = recipient.isClient ? 'client' : null;
          const publicUrl = getPublicFlashReportUrl(incidentId, tokenData.token, brandParam);
          
          return {
            email: recipient.email,
            status: 'failed',
            error: error.message,
            publicUrl: publicUrl
          };
        } catch (urlError) {
          console.error(`Error generating fallback URL for ${recipient.email}:`, urlError);
          return {
            email: recipient.email,
            status: 'failed',
            error: error.message
          };
        }
      }
    }));
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Flash report sent',
        results
      })
    };
  } catch (error) {
    console.error('Error sending flash report:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Error sending flash report',
        message: error.message
      })
    };
  }
};

/**
 * Get branding configuration based on email domain
 * @param {string} email Recipient email address
 * @param {Object} customBranding Optional custom branding to override defaults
 * @returns {Object} Branding configuration
 */
function getBrandingForEmail(email, customBranding = null) {
  // If custom branding is provided, use it
  if (customBranding) {
    return customBranding;
  }
  
  // Extract domain from email
  const domain = email.split('@')[1];
  
  // Domain-based branding mapping - use environment variables for production
  const clientDomains = process.env.CLIENT_DOMAINS ? process.env.CLIENT_DOMAINS.split(',') : ['clientdomain.com', 'company.com'];
  
  // Check if this is a client domain
  const isClientDomain = clientDomains.some(clientDomain => domain.includes(clientDomain));
  
  if (isClientDomain) {
    return {
      logo: process.env.CLIENT_LOGO || 'https://placehold.co/150x50?text=Client',
      companyName: process.env.CLIENT_NAME || 'Client Company',
      colors: {
        primary: process.env.CLIENT_PRIMARY_COLOR || '#0047AB',
        secondary: process.env.CLIENT_SECONDARY_COLOR || '#FF6B00'
      }
    };
  }
  
  // Default branding
  return {
    logo: process.env.DEFAULT_LOGO || 'https://placehold.co/150x50?text=Maritime',
    companyName: process.env.DEFAULT_COMPANY_NAME || 'Maritime Risk Analysis',
    colors: {
      primary: process.env.DEFAULT_PRIMARY_COLOR || '#234567',
      secondary: process.env.DEFAULT_SECONDARY_COLOR || '#890123'
    }
  };
}

/**
 * Get marker color based on incident type
 * @param {string} incidentType Type of incident
 * @returns {string} Hex color code
 */
function getMarkerColorByType(incidentType) {
  const typeColorMap = {
    'piracy': '#FF0000',       // Red
    'robbery': '#FF4500',      // Orange Red
    'hijacking': '#B22222',    // FireBrick
    'kidnapping': '#8B0000',   // Dark Red
    'suspicious': '#FFA500',   // Orange
    'approach': '#FFFF00',     // Yellow
    'attack': '#FF0000',       // Red
    'theft': '#FF8C00',        // Dark Orange
    'boarding': '#FF4500',     // Orange Red
    'default': '#FF0000'       // Default Red
  };
  
  return typeColorMap[incidentType] || typeColorMap.default;
}

/**
 * Generate HTML content for email
 * This is a simplified version - in production, use a proper templating engine
 * or React server-side rendering with the components we created
 * @param {Object} incident Incident data
 * @param {Object} branding Branding configuration
 * @param {Object} templateOverrides Template overrides
 * @param {string} publicUrl Public URL for viewing the report
 */
async function generateEmailHtml(incident, branding, templateOverrides = {}, publicUrl = null) {
  // In production, we would use a more sophisticated HTML generation method
  // For now, use this as a placeholder that returns a simple HTML version
  
  // Simplified HTML template
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Flash Maritime Alert</title>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #FFF7ED; padding: 24px; border-bottom: 1px solid #FFEDD5;">
      <img src="${branding.logo}" alt="${branding.companyName}" style="max-width: 150px; height: auto; margin-bottom: 15px;">
      
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div>
            <span style="display: inline-block; padding: 4px 10px; background-color: #FEE2E2; border-radius: 9999px; color: #991B1B; font-size: 14px; font-weight: bold;">Alert ID: ${incident.id}</span>
            <span style="display: inline-block; padding: 4px 10px; background-color: #FEF3C7; border-radius: 9999px; color: #92400E; font-size: 14px; font-weight: bold;">${incident.type}</span>
          </div>
          <h1 style="font-size: 24px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; color: ${branding.colors.primary};">
            ${incident.vesselName || 'Unknown Vessel'}
          </h1>
          <p style="font-size: 14px; color: #4B5563; margin: 0;">
            ${incident.vesselType || ''} | IMO: ${incident.vesselIMO || 'N/A'} | Flag: ${incident.vesselFlag || 'N/A'}
          </p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Reported</p>
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">
            ${new Date(incident.date).toLocaleString()}
          </p>
        </div>
      </div>
    </div>

    ${publicUrl ? `
    <!-- View Online Banner -->
    <div style="background-color: #EFF6FF; padding: 16px; text-align: center; border-bottom: 1px solid #DBEAFE;">
      <p style="margin: 0; font-size: 14px; color: #1E3A8A;">
        This is an email snapshot. 
        <a href="${publicUrl}" style="color: #2563EB; font-weight: 600; text-decoration: underline;">
          View this Flash Report online
        </a> 
        for the latest information.
      </p>
    </div>
    ` : ''}

    <!-- Location Map -->
    <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${branding.colors.primary}; margin-top: 0; margin-bottom: 16px;">Location</h2>
      ${incident.mapImageUrl ? 
        `<img src="${incident.mapImageUrl}" alt="Incident Location Map" style="width: 100%; border-radius: 4px; border: 1px solid #E5E7EB;">` : 
        '<div style="width: 100%; height: 300px; background-color: #f3f4f6; border-radius: 4px; display: flex; justify-content: center; align-items: center;">Map not available</div>'
      }
    </div>

    <!-- Incident Details -->
    <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${branding.colors.primary}; margin-top: 0; margin-bottom: 16px;">Incident Details</h2>
      <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Description</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.description}</p>
      </div>
    </div>

    <!-- Analysis Section -->
    <div style="padding: 24px;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${branding.colors.primary}; margin-top: 0; margin-bottom: 16px;">Analysis</h2>
      <div style="background-color: #FFF7ED; padding: 16px; border-radius: 6px; border-left: 4px solid ${branding.colors.secondary};">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Key Findings</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${Array.isArray(incident.analysis) ? incident.analysis.join('<br>') : incident.analysis}</p>
      </div>
    </div>

    ${publicUrl ? `
    <!-- View Online Button -->
    <div style="padding: 0 24px 24px; text-align: center;">
      <a href="${publicUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${branding.colors.primary}; color: white; font-weight: 600; text-decoration: none; border-radius: 6px;">
        View Complete Flash Report
      </a>
      <p style="font-size: 12px; color: #6B7280; margin-top: 8px;">
        This link is valid for 7 days and is uniquely generated for you.
      </p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="margin-top: 30px; padding: 0 24px 24px; text-align: center; color: #6B7280; font-size: 12px;">
      <p style="margin: 4px 0;">© ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.</p>
      <p style="margin: 4px 0;">This alert is confidential and for the intended recipient only.</p>
    </div>
  </body>
  </html>
  `;
}