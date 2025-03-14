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
  
  // Support both the new comprehensive format and the older formats
  // First, check if we're using the new comprehensive format with vessels_involved
  const hasVesselsInvolved = incident.vessels_involved && Array.isArray(incident.vessels_involved) && incident.vessels_involved.length > 0;
  
  // Then check for flat format (older approach)
  const isFlat = incident.vesselName !== undefined;
  
  console.log(`EMAIL TEMPLATE - Using ${hasVesselsInvolved ? 'COMPREHENSIVE' : (isFlat ? 'FLAT' : 'NESTED')} data structure`);
  
  // Get the incident fields - choose the appropriate structure
  const fields = hasVesselsInvolved
    ? incident // Comprehensive structure - use directly 
    : (isFlat 
        ? incident // Flat structure - use directly
        : (incident.incident?.fields || incident)); // Nested structure - extract fields
  
  // CRITICAL: Create a default vessel object with required properties
  // This ensures we always have a vessel object with name/type/flag/imo
  const defaultVessel = {
    name: 'Unknown Vessel',
    type: 'Unknown',
    flag: 'Unknown',
    imo: 'N/A'
  };
  
  // Get vessel fields based on structure
  let vesselFields;
  
  if (hasVesselsInvolved) {
    // Using comprehensive structure - extract first vessel from vessels_involved
    const firstVessel = incident.vessels_involved[0];
    vesselFields = {
      name: firstVessel.name,
      type: firstVessel.type,
      flag: firstVessel.flag,
      imo: firstVessel.imo
    };
    console.log('Using VESSELS_INVOLVED data structure:', JSON.stringify(vesselFields));
  } else if (isFlat) {
    // Using flat structure - create vessel fields from top-level properties
    vesselFields = {
      name: incident.vesselName,
      type: incident.vesselType,
      flag: incident.vesselFlag,
      imo: incident.vesselIMO
    };
    console.log('Using FLAT vessel data structure:', JSON.stringify(vesselFields));
  } else {
    // Using nested structure - extract vessel fields as before
    vesselFields = incident.vessel?.fields || defaultVessel;
    console.log('Using NESTED vessel data structure:', JSON.stringify(vesselFields));
  }
  
  // In case vesselFields is an empty object or has missing values, merge with defaults
  if (Object.keys(vesselFields).length === 0) {
    console.log('VESSEL FIELDS EMPTY - ASSIGNING DEFAULTS');
    Object.assign(vesselFields, defaultVessel);
  }
  
  // Ensure all required fields exist
  if (!vesselFields.name) vesselFields.name = defaultVessel.name;
  if (!vesselFields.type) vesselFields.type = defaultVessel.type;
  if (!vesselFields.flag) vesselFields.flag = defaultVessel.flag;
  if (!vesselFields.imo) vesselFields.imo = defaultVessel.imo;
  
  // DEBUG - Check final vessel fields
  console.log('FINAL VESSEL FIELDS:');
  console.log('- name =', vesselFields.name);
  console.log('- type =', vesselFields.type);
  console.log('- flag =', vesselFields.flag);
  console.log('- imo =', vesselFields.imo);
  
  // Force the values to be strings to avoid rendering issues
  const hardcodedVessel = {
    name: "TEST VESSEL",
    type: "TEST TYPE",
    flag: "TEST FLAG",
    imo: "TEST IMO"
  };
  
  // Ensure all required fields exist
  if (!vesselFields.name) {
    console.log('FIXING MISSING NAME');
    vesselFields.name = hardcodedVessel.name; 
  }
  if (!vesselFields.type) vesselFields.type = hardcodedVessel.type;
  if (!vesselFields.flag) vesselFields.flag = hardcodedVessel.flag;
  if (!vesselFields.imo) vesselFields.imo = hardcodedVessel.imo;
  
  // Log the final vessel data used in the template
  console.log('EMAIL TEMPLATE - FINAL VESSEL DATA:');
  console.log(JSON.stringify(vesselFields));
  
  // Handle incident vessel fields - support all structures
  let incidentVesselFields = {};
  
  if (hasVesselsInvolved) {
    // Using comprehensive structure with vessels_involved
    // The vessel status might be directly on the incident or in the vessels_involved array
    const firstVessel = incident.vessels_involved[0];
    incidentVesselFields = {
      vessel_status_during_incident: incident.status || firstVessel.status_during_incident,
      crew_impact: incident.crew_impact || firstVessel.crew_impact
    };
    console.log('Using COMPREHENSIVE incident vessel structure:', JSON.stringify(incidentVesselFields));
  } else if (isFlat) {
    // Using flat structure - extract incident vessel fields from top level
    incidentVesselFields = {
      vessel_status_during_incident: incident.status || incident.vessel_status_during_incident || incident.incident_vessel_vessel_status_during_incident,
      crew_impact: incident.crewStatus || incident.crew_impact || incident.incident_vessel_crew_impact
    };
    console.log('Using FLAT incident vessel structure:', JSON.stringify(incidentVesselFields));
  } else {
    // Using nested structure - extract as before
    incidentVesselFields = incident.incidentVessel?.fields || {};
    console.log('Using NESTED incident vessel structure:', JSON.stringify(incidentVesselFields));
  }
  
  // Similarly for incident type
  let incidentTypeFields = {};
  
  if (hasVesselsInvolved) {
    // In comprehensive format, incident_type is an array
    if (incident.incident_type && incident.incident_type.length > 0) {
      incidentTypeFields = { name: incident.incident_type[0] };
      console.log('Using COMPREHENSIVE incident type:', incidentTypeFields.name);
    } else {
      incidentTypeFields = { name: 'Incident' };
    }
  } else if (isFlat) {
    // Type is directly available in flat structure
    incidentTypeFields = { name: incident.type || incident.incident_type_name };
    console.log('Using FLAT incident type:', incidentTypeFields.name);
  } else {
    // Using nested structure for type
    incidentTypeFields = incident.incidentType?.fields || {};
    console.log('Using NESTED incident type:', incidentTypeFields.name);
  }
  
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
  
  // Log the complete data structure to debug
  console.log('EMAIL TEMPLATE - DATA STRUCTURE:');
  console.log('- incident fields keys:', fields ? Object.keys(fields).join(', ') : 'none');
  console.log('- vessel fields keys:', vesselFields ? Object.keys(vesselFields).join(', ') : 'none');
  console.log('- incidentVessel fields keys:', incidentVesselFields ? Object.keys(incidentVesselFields).join(', ') : 'none');
  console.log('- incidentType fields keys:', incidentTypeFields ? Object.keys(incidentTypeFields).join(', ') : 'none');
  
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
              <span style="display: inline-block; padding: 4px 10px; background-color: #FEE2E2; border-radius: 9999px; color: #991B1B; font-size: 14px; font-weight: bold;">Alert ID: ${fields.id}</span>
              <span style="display: inline-block; padding: 4px 10px; background-color: #FEF3C7; border-radius: 9999px; color: #92400E; font-size: 14px; font-weight: bold;">${incidentTypeFields.name || fields.type || 'Incident'}</span>
            </div>
            <h1 style="font-size: 24px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; color: ${primaryColor};">
              HARDCODED VESSEL NAME TEST
            </h1>
            <p style="font-size: 14px; color: #4B5563; margin: 0;">
              <span style="display: inline-block; margin-right: 10px; color: #111827;">Type: <strong>HARDCODED VESSEL TYPE</strong></span> | 
              <span style="display: inline-block; margin: 0 10px; color: #111827;">IMO: <strong>12345678</strong></span> | 
              <span style="display: inline-block; margin-left: 10px; color: #111827;">Flag: <strong>HARDCODED FLAG</strong></span>
            </p>
            <p style="font-size: 14px; color: red; font-weight: bold; margin-top: 10px;">
              VESSEL DATA TEST: The following values are from the template data:<br>
              vesselFields.name = ${vesselFields.name || 'null/undefined'}<br>
              vesselFields.type = ${vesselFields.type || 'null/undefined'}<br>
              vesselFields.flag = ${vesselFields.flag || 'null/undefined'}<br>
              vesselFields.imo = ${vesselFields.imo || 'null/undefined'}
            </p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Reported</p>
            <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">
              ${new Date(fields.date_time_utc || fields.date).toLocaleString()}
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
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${fields.location_name || fields.location || 'Unknown Location'}</p>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">
            ${formatCoord(fields.latitude, true)}, 
            ${formatCoord(fields.longitude, false)}
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
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${incidentVesselFields.vessel_status_during_incident || 'Unknown'}</p>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">${vesselFields.type || 'Vessel'}</p>
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
          <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">${incidentVesselFields.crew_impact || 'No injuries reported'}</p>
        </div>
      </div>
    </div>

    <!-- Location Map -->
    <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Location Map</h2>
      
      <!-- Map Image with fallback options -->
      ${fields.map_image_url ? 
        `<img src="${fields.map_image_url}" alt="Incident Location Map" style="width: 100%; border-radius: 4px; border: 1px solid #E5E7EB;" 
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
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${fields.description || 'No description available'}</p>
      </div>
    </div>

    <!-- Analysis Section -->
    <div style="padding: 24px;">
      <h2 style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Analysis</h2>
      <div style="background-color: #FFF7ED; padding: 16px; border-radius: 6px; border-left: 4px solid ${secondaryColor};">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Key Findings</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">
          ${Array.isArray(fields.analysis) ? fields.analysis.join('<br>') : fields.analysis || 'No analysis available'}
        </p>
      </div>
      
      ${fields.recommendations ? `
      <div style="background-color: #F0F9FF; padding: 16px; border-radius: 6px; border-left: 4px solid ${primaryColor}; margin-top: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Recommendations</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${fields.recommendations}</p>
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