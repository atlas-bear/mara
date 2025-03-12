/**
 * Email utility functions for MARA
 * Contains functions to work with SendGrid email service
 * and React email rendering
 */

import sgMail from '@sendgrid/mail';
import { getEnv } from './environment.js';

/**
 * Initialize and return SendGrid client
 * @returns {Object|null} SendGrid client or null if API key is not available
 */
export function getSendGridClient() {
  const apiKey = getEnv('SENDGRID_API_KEY');
  
  if (!apiKey) {
    console.warn('SendGrid API key not found in environment variables');
    return null;
  }
  
  try {
    sgMail.setApiKey(apiKey);
    return sgMail;
  } catch (error) {
    console.error('Error initializing SendGrid client:', error);
    return null;
  }
}

/**
 * Send a simple email using SendGrid
 * @param {string} to Recipient email address
 * @param {string} subject Email subject
 * @param {string} message Email message (plain text)
 * @param {string} html Email message (HTML format, optional)
 * @param {Object} options Additional options for the email
 * @returns {Promise<Object>} SendGrid response
 */
export async function sendEmail(to, subject, message, html = null, options = {}) {
  const sgMail = getSendGridClient();
  
  if (!sgMail) {
    console.warn('SendGrid client not available, email not sent');
    return {
      success: false,
      message: 'Email service not available',
      demo: true
    };
  }
  
  const fromEmail = getEnv('SENDGRID_FROM_EMAIL', 'alerts@example.com');
  const fromName = options.fromName || 'MARA Alert System';
  
  const emailData = {
    to,
    from: {
      email: fromEmail,
      name: fromName
    },
    subject,
    text: message,
    ...options
  };
  
  // Add HTML content if provided
  if (html) {
    emailData.html = html;
  }
  
  try {
    const [response] = await sgMail.send(emailData);
    
    return {
      success: true,
      message: 'Email sent successfully',
      statusCode: response.statusCode,
      headers: response.headers
    };
  } catch (error) {
    console.error('Error sending email:', error);
    
    return {
      success: false,
      message: error.message,
      statusCode: error.code || 500,
      error
    };
  }
}

/**
 * Lightweight HTML template renderer for email
 * This simpler approach avoids the large dependencies of react-email
 * 
 * @param {Object} data Data to use in the template 
 * @param {Object} options Additional options
 * @returns {string} Rendered HTML
 */
export function renderEmailTemplate(data, options = {}) {
  // Extract commonly used values
  const {
    incident,
    branding = {},
    publicUrl = null
  } = data;
  
  // Extract branding details
  const {
    logo = '/default-logo.png',
    companyName = 'Maritime Risk Analysis',
    colors = {}
  } = branding;
  
  const primaryColor = colors.primary || '#234567';
  const secondaryColor = colors.secondary || '#890123';
  
  // Format coordinates helper
  const formatCoord = (coordinate, isLatitude) => {
    if (coordinate === null || coordinate === undefined || isNaN(coordinate)) {
      return 'N/A';
    }
    
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
    
    let direction = '';
    if (isLatitude) {
      direction = coordinate >= 0 ? 'N' : 'S';
    } else {
      direction = coordinate >= 0 ? 'E' : 'W';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };
  
  // Vessel data - support both camelCase (from client) and snake_case (from server) formats
  const vesselName = incident.vesselName || 'Unknown Vessel';
  const vesselType = incident.vesselType || 'Unknown';
  const vesselFlag = incident.vesselFlag || 'Unknown';
  const vesselIMO = incident.vesselIMO || 'N/A';
  
  // Log vessel data to debug
  console.log('EMAIL TEMPLATE - VESSEL DATA:');
  console.log('vesselName:', vesselName);
  console.log('vesselType:', vesselType);
  console.log('vesselFlag:', vesselFlag);
  console.log('vesselIMO:', vesselIMO);
  
  // Current year for copyright
  const currentYear = new Date().getFullYear();
  
  // Render HTML based on the style of the React component
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Flash Maritime Alert</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
    <!-- Logo/Branding Section - Outside the card -->
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logo}" alt="${companyName}" style="max-width: 180px; height: auto;">
    </div>
    
    <!-- Main Content Card with Shadow -->
    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);">
    
      <!-- Header Section -->
      <div style="background-color: #FFF7ED; padding: 24px; border-bottom: 1px solid #FFEDD5;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <span style="display: inline-block; padding: 4px 10px; background-color: #FEE2E2; border-radius: 9999px; color: #991B1B; font-size: 14px; font-weight: bold;">Alert ID: ${incident.id}</span>
              <span style="display: inline-block; padding: 4px 10px; background-color: #FEF3C7; border-radius: 9999px; color: #92400E; font-size: 14px; font-weight: bold;">${incident.type}</span>
            </div>
            <h1 style="font-size: 24px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; color: ${primaryColor};">
              ${vesselName}
            </h1>
            <p style="font-size: 14px; color: #4B5563; margin: 0;">
              <span style="display: inline-block; margin-right: 10px; color: #111827;">Type: <strong>${vesselType}</strong></span> | 
              <span style="display: inline-block; margin: 0 10px; color: #111827;">IMO: <strong>${vesselIMO}</strong></span> | 
              <span style="display: inline-block; margin-left: 10px; color: #111827;">Flag: <strong>${vesselFlag}</strong></span>
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

    <!-- Quick Facts Grid -->
    <div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 24px; border-bottom: 1px solid #E5E7EB;">
      <!-- Location Details -->
      <div style="flex: 1; min-width: 200px; display: flex; align-items: flex-start; gap: 12px;">
        <!-- Map Pin SVG Icon -->
        <div style="width: 20px; height: 20px; margin-top: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Location</p>
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${incident.location || 'Unknown Location'}</p>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">
            ${formatCoord(incident.coordinates?.latitude, true)}, 
            ${formatCoord(incident.coordinates?.longitude, false)}
          </p>
        </div>
      </div>
      
      <!-- Vessel Status -->
      <div style="flex: 1; min-width: 200px; display: flex; align-items: flex-start; gap: 12px;">
        <!-- Ship SVG Icon -->
        <div style="width: 20px; height: 20px; margin-top: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.4 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
            <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
            <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
          </svg>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Vessel Status</p>
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${incident.vessel_status_during_incident || incident.status || 'Unknown'}</p>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">${vesselType}</p>
        </div>
      </div>
      
      <!-- Crew Status -->
      <div style="flex: 1; min-width: 200px; display: flex; align-items: flex-start; gap: 12px;">
        <!-- Users SVG Icon -->
        <div style="width: 20px; height: 20px; margin-top: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Crew Status</p>
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">${incident.crew_impact || incident.crewStatus || 'No injuries reported'}</p>
        </div>
      </div>
    </div>

    <!-- Location Map -->
    <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Location Map</h2>
      
      <!-- Map Image with fallback options -->
      ${incident.mapImageUrl ? 
        `<img src="${incident.mapImageUrl}" alt="Incident Location Map" style="width: 100%; border-radius: 4px; border: 1px solid #E5E7EB;" 
              onerror="this.onerror=null; this.src='https://res.cloudinary.com/dwnh4b5sx/image/upload/maps/public/error-map.jpg';">` : 
        '<div style="width: 100%; height: 300px; background-color: #f3f4f6; border-radius: 4px; display: flex; justify-content: center; align-items: center; text-align: center; color: #6B7280;">Map image not available</div>'
      }
      
      <div style="margin-top: 8px; font-size: 12px; color: #6B7280; display: flex; align-items: center;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${secondaryColor}; display: inline-block; margin-right: 5px;"></span>
        <span>Incident Location</span>
      </div>
    </div>

    <!-- Incident Details -->
    <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Incident Details</h2>
      <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Description</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.description}</p>
      </div>
    </div>

    <!-- Analysis Section -->
    <div style="padding: 24px;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Analysis</h2>
      <div style="background-color: #FFF7ED; padding: 16px; border-radius: 6px; border-left: 4px solid ${secondaryColor};">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Key Findings</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">
          ${Array.isArray(incident.analysis) ? incident.analysis.join('<br>') : incident.analysis}
        </p>
      </div>
      
      ${incident.recommendations ? `
      <div style="background-color: #F0F9FF; padding: 16px; border-radius: 6px; border-left: 4px solid ${primaryColor}; margin-top: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Recommendations</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.recommendations}</p>
      </div>
      ` : ''}
    </div>

    ${publicUrl ? `
    <!-- View Online Button -->
    <div style="padding: 0 24px 24px; text-align: center;">
      <a href="${publicUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: white; font-weight: 600; text-decoration: none; border-radius: 6px;">
        View Complete Flash Report
      </a>
      <p style="font-size: 12px; color: #6B7280; margin-top: 8px;">
        This link is valid for 365 days and is uniquely generated for you.
      </p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="margin-top: 30px; padding: 20px 24px 24px; text-align: center; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB;">
      <p style="margin: 4px 0;">© ${currentYear} ${companyName}. All rights reserved.</p>
      <p style="margin: 4px 0;">This alert is confidential and for the intended recipient only.</p>
    </div>
    
    </div> <!-- End of Main Content Card -->
  </body>
  </html>
  `;
}