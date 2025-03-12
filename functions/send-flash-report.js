import sgMail from '@sendgrid/mail';
import axios from 'axios';
import { getIncident } from './utils/incident-utils.js';
import { getVesselByIMO, getVesselByName, getVesselById } from './utils/vessel-utils.js';
import { validateData } from './utils/validation.js';
import { corsHeaders } from './utils/environment.js';
import { generateFlashReportToken, getPublicFlashReportUrl } from './utils/token-utils.js';
import { renderReactEmailTemplate } from './utils/email.js';

/**
 * Netlify function to send flash reports via SendGrid
 * This handles the email sending functionality, keeping API keys secure
 * and avoiding CORS issues
 * 
 * ENVIRONMENT VARIABLE USAGE:
 * - In Netlify functions, use process.env directly (NOT import.meta.env)
 * - Required variables:
 *   - MAPBOX_TOKEN - MapBox API token for maps
 *   - SENDGRID_API_KEY - SendGrid API key
 *   - SENDGRID_FROM_EMAIL - Email sender address
 * - Don't use VITE_ prefixed variables in server-side code
 * 
 * See ENVIRONMENT.md for complete documentation on environment variables
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
    // Variables for coordinate handling - declared at the top to ensure scope
    let latitude = null;
    let longitude = null;
    
    // Define vesselData at the top level to ensure it's always defined
    let vesselData = {};
    
    // Configure SendGrid - in Netlify functions use process.env directly
    const apiKey = process.env.SENDGRID_API_KEY;
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
        console.log('Attempting to fetch incident data from Airtable...');
        // This will now return a complex object with incident, vessel, and incidentType data
        const airtableData = await getIncident(incidentId);
        
        if (airtableData) {
          console.log('Airtable data fetch successful!');
          
          // Extract the data components - note the new incidentVessel data
          incidentData = airtableData.incident || {};
          const fetchedVesselData = airtableData.vessel || {};
          const fetchedIncidentVesselData = airtableData.incidentVessel || {}; 
          const incidentTypeData = airtableData.incidentType || {};
          
          // Log what we found
          console.log('Incident data:', Object.keys(incidentData).join(', '));
          console.log('Vessel data:', fetchedVesselData ? Object.keys(fetchedVesselData).join(', ') : 'none');
          console.log('Incident Vessel data:', fetchedIncidentVesselData ? Object.keys(fetchedIncidentVesselData).join(', ') : 'none');
          console.log('Incident type data:', incidentTypeData ? Object.keys(incidentTypeData).join(', ') : 'none');
          
          // Combine data for easier access in the template
          // Update vesselData with data from relationship
          vesselData = fetchedVesselData || {};
          const incidentVesselData = fetchedIncidentVesselData || {};
          
          // Add vessel status and crew impact from incident_vessel if available
          if (incidentVesselData) {
            if (incidentVesselData.vessel_status_during_incident) {
              incidentData.vessel_status_during_incident = incidentVesselData.vessel_status_during_incident;
            }
            if (incidentVesselData.crew_impact) {
              incidentData.crew_impact = incidentVesselData.crew_impact;
            }
            if (incidentVesselData.damage_sustained) {
              incidentData.damage_sustained = incidentVesselData.damage_sustained;
            }
            console.log('Added incident_vessel data to incident record');
          }
          
          // Log vessel data before we use it
          console.log('VESSEL DATA DEBUG:');
          console.log('- vesselData direct:', JSON.stringify(vesselData));
          console.log('- vessel name from vessel table:', vesselData.name);
          console.log('- vessel type from vessel table:', vesselData.type);
          console.log('- vessel flag from vessel table:', vesselData.flag);
          console.log('- vessel IMO from vessel table:', vesselData.imo);
          
          // Check for direct vessel data in incident record
          if (incidentData.vessel) {
            console.log('- Direct vessel link in incident:', incidentData.vessel);
          }
          
          // Add incident type info to incident data
          if (incidentTypeData && incidentTypeData.name) {
            incidentData.incident_type_name = incidentTypeData.name;
          }
        } else {
          console.log('No data found in Airtable');
        }
      } catch (airtableError) {
        console.warn('Could not fetch from Airtable:', airtableError.message);
        console.log('Sample incident ID check:', incidentId, 'Matches?', incidentId === '2025-0010');
        
        // If Airtable fetch fails and this is the sample incident ID, use sample data
        if (incidentId === '2025-0010') {
          console.log('Using sample incident data instead');
          incidentData = sampleIncidentData;
          
          // Create sample vessel data since we're using the sample data
          vesselData = {
            name: incidentData.vessel_name,
            type: incidentData.vessel_type,
            flag: incidentData.vessel_flag,
            imo: incidentData.vessel_imo
          };
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
    
    // Extract map image URL directly from Airtable data
    let mapImageUrl = '';
    try {
      // Extract coordinates for email display
      latitude = parseFloat(incidentData.latitude) || 0;
      longitude = parseFloat(incidentData.longitude) || 0;
      
      console.log('Incident coordinates:', latitude, longitude);
      
      // Use map_image_url field from Airtable if available
      if (incidentData.map_image_url && typeof incidentData.map_image_url === 'string') {
        mapImageUrl = incidentData.map_image_url;
        console.log('Using map image URL from Airtable:', mapImageUrl);
      } else {
        console.log('No map_image_url found in incident data, using default map');
        
        // Fall back to a default map in Cloudinary
        mapImageUrl = 'https://res.cloudinary.com/dwnh4b5sx/image/upload/maps/public/default-map.jpg';
      }
    } catch (mapError) {
      console.error('Error processing map data:', mapError);
      
      // Use a fallback image in case of any error
      mapImageUrl = 'https://res.cloudinary.com/dwnh4b5sx/image/upload/maps/public/error-map.jpg';
      console.log('Using error fallback map image');
    }
    
    // Log final coordinates for prepared data
    console.log('Using coordinates for prepared data:', latitude, longitude);
                     
    // Prepare incident data for email - with more fallbacks and logging
    console.log('Preparing data for email template...');
    
    // Safety check - make sure incidentData is an object
    if (!incidentData || typeof incidentData !== 'object') {
      console.error('incidentData is not a valid object!', incidentData);
      incidentData = {
        id: incidentId,
        description: 'No incident data available'
      };
    }
    
    // Detailed debugging for incident type
    console.log('DETAILED INCIDENT TYPE ANALYSIS:');
    if (incidentData.incident_type_name) {
      console.log('- Found incident_type_name:', incidentData.incident_type_name);
    }
    if (incidentData.incident_type) {
      console.log('- Found incident_type:', 
        typeof incidentData.incident_type === 'string' 
          ? incidentData.incident_type 
          : JSON.stringify(incidentData.incident_type));
    }
    
    // Get incident type with best available data
    let incidentType = 'Incident';
    
    // Looking at the CSV files, we can use the 'title' field to extract incident type
    // Some incident types found in the CSV: "Robbery", "Boarding", "Attack", "Piracy", etc.
    
    // First try using the incident_type_name field if it's a string
    if (incidentData.incident_type_name && typeof incidentData.incident_type_name === 'string') {
      incidentType = incidentData.incident_type_name;
      console.log('Using incident_type_name string directly:', incidentType);
    }
    // Best option: use the title field which appears to have the meaningful info
    else if (incidentData.title && typeof incidentData.title === 'string') {
      // From CSV examples, titles usually start with incident type:
      // "Armed Robbery Aboard ASPASIA LUCK"
      // "UAV Attack on Russian Naval Base"
      // "Chinese Fishing Vessel Hijacking off Somalia"
      
      // Get first few words from title, which usually indicate incident type
      const words = incidentData.title.split(' ');
      
      // First handle common cases seen in the CSV
      if (incidentData.title.toLowerCase().includes('robbery')) {
        incidentType = 'Robbery';
      } else if (incidentData.title.toLowerCase().includes('attack')) {
        incidentType = 'Attack';
      } else if (incidentData.title.toLowerCase().includes('boarding')) {
        incidentType = 'Boarding';
      } else if (incidentData.title.toLowerCase().includes('hijacking')) {
        incidentType = 'Hijacking';
      } else if (incidentData.title.toLowerCase().includes('piracy')) {
        incidentType = 'Piracy';
      } else {
        // Default: take first two words as type
        incidentType = words.slice(0, 2).join(' ');
      }
      
      console.log('Extracted incident type from title:', incidentType);
    }
    // Last resort: use any other available fields
    else if (incidentData.type) {
      incidentType = typeof incidentData.type === 'string' ? incidentData.type : 'Incident';
    } 
    
    // Handle specific cases for this Airtable format
    if (incidentType === 'Armed Robbery') {
      // Add an emoji to make it more noticeable
      incidentType = '🚨 Armed Robbery';
    }
    
    console.log('Final incident type for email:', incidentType);
    
    // Detailed debugging for vessel data
    console.log('DETAILED VESSEL DATA ANALYSIS:');
    console.log('- vesselData available:', !!vesselData);
    console.log('- vesselData keys:', vesselData ? Object.keys(vesselData).join(', ') : 'none');
    console.log('- vesselData complete object:', JSON.stringify(vesselData));
    
    if (vesselData) {
      if (vesselData.name) console.log('- vesselData.name:', vesselData.name);
      if (vesselData.type) console.log('- vesselData.type:', vesselData.type);
      if (vesselData.flag) console.log('- vesselData.flag:', vesselData.flag);
      if (vesselData.imo) console.log('- vesselData.imo:', vesselData.imo);
    }
    
    // From CSV data, we can see the vessel table has:
    // id, name, type, flag, imo, beam, length, draft, incident_vessel_id
    
    // Get vessel name from title if not available from vessel data
    let extractedVesselName = null;
    if (incidentData.title) {
      // Extract vessel name from title - based on naming pattern in CSV
      // Examples: "Armed Robbery Aboard ASPASIA LUCK", "Missile Attack on OLYMPIC SPIRIT"
      const title = incidentData.title;
      
      // Common patterns in the title where vessel name appears
      const vesselIndicators = ['aboard', 'on', 'involving', 'of'];
      
      for (const indicator of vesselIndicators) {
        const index = title.toLowerCase().indexOf(indicator + ' ');
        if (index !== -1) {
          // Take everything after the indicator
          const afterIndicator = title.substring(index + indicator.length + 1);
          
          // If there's additional text (like "in Gulf of Guinea"), take what's before it
          const endIndex = afterIndicator.indexOf(' in ');
          if (endIndex !== -1) {
            extractedVesselName = afterIndicator.substring(0, endIndex).trim();
          } else {
            extractedVesselName = afterIndicator.trim();
          }
          console.log(`Extracted vessel name from title using "${indicator}": ${extractedVesselName}`);
          break;
        }
      }
    }
    
    // Combine all vessel data sources with proper fallbacks
    // Debug the source of vessel data
    console.log('COMBINED VESSEL DATA SOURCES:');
    console.log('- incidentData full object:', JSON.stringify(incidentData).substring(0, 500) + '...');
    console.log('- vesselData full object:', JSON.stringify(vesselData).substring(0, 500) + '...');
    
    // For non-sample incidents, vesselData comes from the vessel table via the relationship
    // For sample incidents, vesselData is created directly from the sample incident data
    
    // Sample case debug output
    console.log('VESSEL DATA FIELDS FROM AIRTABLE VESSEL TABLE:');
    if (vesselData) {
      console.log('- name:', vesselData.name);
      console.log('- type:', vesselData.type);
      console.log('- flag:', vesselData.flag);
      console.log('- imo:', vesselData.imo);
    } else {
      console.log('No vessel data from Airtable vessel table');
    }
    
    // Incident case debug output
    console.log('VESSEL DATA FIELDS FROM INCIDENT RECORD:');
    console.log('- vessel_name:', incidentData.vessel_name);
    console.log('- vessel_type:', incidentData.vessel_type);
    console.log('- vessel_flag:', incidentData.vessel_flag);
    console.log('- vessel_imo:', incidentData.vessel_imo);
    
    // Title extraction debug output
    console.log('- extractedVesselName from title:', extractedVesselName);
    
    // For relational data (from Airtable), the vessel info comes from vesselData
    // For sample data, the vessel info is included directly in the incidentData
    // For real incidents, prioritize data from the vessel table via the relation
    
    // Start with vessel data from the relationship query
    let enhancedVesselData = vesselData || {};
    let lookupMethod = "vessel relationship data";
    
    // If vessel data is incomplete, try multiple lookup strategies
    if (!enhancedVesselData?.name || !enhancedVesselData?.type || !enhancedVesselData?.flag) {
      console.log('Incomplete vessel data detected. Attempting alternative lookups...');
      
      // Strategy 1: Check for direct vessel reference in the incident
      if (incidentData.vessel && typeof incidentData.vessel === 'string' && incidentData.vessel.startsWith('rec')) {
        console.log('Found direct vessel reference ID in incident:', incidentData.vessel);
        try {
          const directVesselData = await getVesselById(incidentData.vessel);
          if (directVesselData) {
            console.log('Successfully fetched vessel by direct ID reference:', Object.keys(directVesselData).join(', '));
            enhancedVesselData = directVesselData;
            lookupMethod = "direct vessel ID lookup";
          }
        } catch (vesselIdError) {
          console.error('Error looking up vessel by ID:', vesselIdError.message);
        }
      }
      
      // Strategy 2: Try IMO lookup if we have one and still need data
      if ((!enhancedVesselData?.type || !enhancedVesselData?.flag) && 
         (enhancedVesselData?.imo || incidentData.vessel_imo)) {
        const foundIMO = enhancedVesselData?.imo || incidentData.vessel_imo;
        console.log(`Found IMO ${foundIMO}, attempting IMO lookup...`);
        
        try {
          const imoVesselData = await getVesselByIMO(foundIMO);
          if (imoVesselData) {
            console.log('Successfully fetched vessel by IMO:', Object.keys(imoVesselData).join(', '));
            enhancedVesselData = imoVesselData;
            lookupMethod = "IMO lookup";
          }
        } catch (imoError) {
          console.error('Error looking up vessel by IMO:', imoError.message);
        }
      }
      
      // Strategy 3: Try vessel name lookup if we have a name and still need data
      if ((!enhancedVesselData?.type || !enhancedVesselData?.flag) && 
         (enhancedVesselData?.name || incidentData.vessel_name || extractedVesselName)) {
        const foundName = enhancedVesselData?.name || incidentData.vessel_name || extractedVesselName;
        
        if (foundName) {
          console.log(`Found vessel name "${foundName}", attempting name lookup...`);
          try {
            const nameVesselData = await getVesselByName(foundName);
            if (nameVesselData) {
              console.log('Successfully fetched vessel by name:', Object.keys(nameVesselData).join(', '));
              enhancedVesselData = nameVesselData;
              lookupMethod = "name lookup";
            }
          } catch (nameError) {
            console.error('Error looking up vessel by name:', nameError.message);
          }
        }
      }
      
      // Strategy 4: As a last resort, use the embedded vessel fields from incident record
      if (!enhancedVesselData?.type || !enhancedVesselData?.flag) {
        if (incidentData.vessel_type || incidentData.vessel_flag) {
          console.log('Using embedded vessel fields from incident record');
          // Create a merged object with embedded fields as fallbacks
          enhancedVesselData = {
            ...enhancedVesselData,
            name: enhancedVesselData?.name || incidentData.vessel_name || extractedVesselName,
            type: enhancedVesselData?.type || incidentData.vessel_type,
            flag: enhancedVesselData?.flag || incidentData.vessel_flag,
            imo: enhancedVesselData?.imo || incidentData.vessel_imo
          };
          lookupMethod = "incident embedded vessel fields";
        }
      }
    }
    
    console.log(`Vessel data source: ${lookupMethod}`);
    console.log('Final enhanced vessel data:', JSON.stringify(enhancedVesselData));
    
    // CLAUDE CODE TEST - Verify this code is running
    console.log('CLAUDE CODE TEST - VESSEL DATA UPDATE IS RUNNING');
    
    // Use enhanced vessel data directly (it already contains all the prioritization)
    const vesselName = enhancedVesselData?.name || extractedVesselName || 'Unknown Vessel';
    const vesselType = enhancedVesselData?.type || 'Vessel';
    const vesselFlag = enhancedVesselData?.flag || 'Unknown';
    const vesselIMO = enhancedVesselData?.imo || '-';
    
    console.log('FINAL VESSEL DATA AFTER PROCESSING:');
    console.log('- Name:', vesselName);
    console.log('- Type:', vesselType);
    console.log('- Flag:', vesselFlag);
    console.log('- IMO:', vesselIMO);
    
    console.log('Final vessel data for email:', {
      name: vesselName,
      type: vesselType,
      flag: vesselFlag,
      imo: vesselIMO
    });
    
    // Prepare incident data for email
    const preparedIncident = {
      id: incidentData.id,
      type: incidentType,
      date: incidentData.date_time_utc || incidentData.date,
      location: incidentData.location_name || incidentData.location || 'Unknown Location',
      coordinates: {
        latitude: latitude !== null && !isNaN(latitude) ? parseFloat(latitude) : 0,
        longitude: longitude !== null && !isNaN(longitude) ? parseFloat(longitude) : 0
      },
      vesselName: vesselName,
      vesselType: vesselType,
      vesselFlag: vesselFlag,
      vesselIMO: vesselIMO,
      status: incidentData.vessel_status_during_incident || incidentData.status || 'Unknown Status',
      destination: incidentData.vessel_destination || incidentData.destination || 'Unknown Destination',
      crewStatus: incidentData.crew_impact || incidentData.crewStatus || 'No information available',
      description: incidentData.description || 'No description available',
      responseActions: incidentData.response_type || incidentData.responseActions || [],
      authorities_notified: incidentData.authorities_notified || [],
      items_stolen: incidentData.items_stolen || [],
      analysis: incidentData.analysis || 'No analysis available',
      recommendations: incidentData.recommendations || '',
      mapImageUrl
    };
    
    // Log full prepared incident data for debugging
    console.log('FULL PREPARED INCIDENT DATA:');
    console.log({
      id: preparedIncident.id,
      type: preparedIncident.type,
      vesselName: preparedIncident.vesselName,
      vesselType: preparedIncident.vesselType,
      vesselFlag: preparedIncident.vesselFlag,
      vesselIMO: preparedIncident.vesselIMO,
      mapImageUrl: preparedIncident.mapImageUrl,
      coordinates: preparedIncident.coordinates,
      location: preparedIncident.location
    });
    
    // If test mode is enabled, check if we should skip emails
    if (testMode) {
      // The skipEmails parameter is used by the direct test API call
      // The normal Send Flash Report button doesn't include it, so will send emails
      const skipEmails = payload.skipEmails === true;
      console.log(`TEST MODE ENABLED: Will generate tokens and URLs${skipEmails ? ' but skip actual email sending' : ' and send actual emails'}`);
      
      // Generate tokens and URLs for testing
      const testResults = await Promise.all(recipients.map(async (recipient) => {
        // Generate a secure token for testing - using 1 year expiry
        const tokenData = generateFlashReportToken(incidentId, 8760);
        
        // Determine URL branding based on recipient email domain
        const brandParam = shouldUseClientBranding(recipient.email) ? 'client' : null;
        
        // Generate public flash report URL
        const publicUrl = getPublicFlashReportUrl(incidentId, tokenData.token, brandParam);
        
        return {
          email: recipient.email,
          status: skipEmails ? 'test-mode' : 'pending-send',
          token: tokenData.token,
          publicUrl: publicUrl
        };
      }));
      
      // Log public URLs for testing
      console.log('TEST MODE: Public URLs generated:');
      testResults.forEach(r => {
        console.log(`- ${r.email}: ${r.publicUrl}`);
      });
      
      // If skipping emails, return early
      if (skipEmails) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Flash report test completed (no emails sent)',
            testMode: true,
            skipEmails: true,
            results: testResults
          })
        };
      }
      
      // Otherwise, continue to the email sending code below with our pre-generated tokens
      console.log('TEST MODE: Continuing to send actual emails with pre-generated tokens');
    }
    
    // In Netlify functions, use process.env directly
    // Not using VITE_ prefixed variables as those are for client-side code
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL;
    
    // Check if SendGrid API key is available
    if (!sendGridApiKey) {
      console.warn('SendGrid API key not found in environment variables');
      console.log('Environment variables available:', Object.keys(process.env).filter(key => !key.includes('SECRET')).join(', '));
      console.log('Looking for: SENDGRID_API_KEY or VITE_SENDGRID_API_KEY');
      
      // Generate tokens and URLs for testing even without SendGrid
      const testResults = await Promise.all(recipients.map(async (recipient) => {
        // Generate a secure token for testing - using 1 year expiry
        const tokenData = generateFlashReportToken(incidentId, 8760);
        
        // Determine URL branding based on recipient email domain
        const brandParam = shouldUseClientBranding(recipient.email) ? 'client' : null;
        
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
        // Always use default MARA branding for emails (regardless of recipient)
        const branding = getDefaultBranding();
        
        // Generate a secure token for this recipient - using 8760 hours (1 year) for expiry
        const tokenData = generateFlashReportToken(incidentId, 8760); // 1 year expiry
        
        // Determine URL branding based on recipient email domain
        const brandParam = shouldUseClientBranding(recipient.email) ? 'client' : null;
        
        // Generate public flash report URL
        const publicUrl = getPublicFlashReportUrl(incidentId, tokenData.token, brandParam);
        
        // Create email subject
        const subject = `🚨 MARITIME ALERT: ${preparedIncident.vesselName} Incident`;
        
        // Create HTML content with public link
        // Before sending, log the vessel data one final time to verify
        console.log('DEBUG - VESSEL DATA BEING SENT TO EMAIL:', {
          vesselName: preparedIncident.vesselName,
          vesselType: preparedIncident.vesselType,
          vesselFlag: preparedIncident.vesselFlag,
          vesselIMO: preparedIncident.vesselIMO
        });
        
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
            email: sendGridFromEmail || 'alerts@example.com',
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
          const tokenData = generateFlashReportToken(incidentId, 8760); // 1 year expiry
          const brandParam = shouldUseClientBranding(recipient.email) ? 'client' : null;
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
 * Determine if client branding should be used for a recipient's URL
 * This is separated from email branding to allow email to always use MARA branding
 * @param {string} email Recipient email address
 * @returns {boolean} Whether to use client branding for URLs
 */
function shouldUseClientBranding(email) {
  // Extract domain from email
  const domain = email.split('@')[1] || '';
  console.log(`Checking domain for client branding: ${domain}`);
  
  // Domain-based branding mapping - use environment variables for production
  const clientDomains = process.env.CLIENT_DOMAINS ? 
                       process.env.CLIENT_DOMAINS.split(',') : 
                       ['clientdomain.com', 'company.com', 'atlasbear.co'];
  
  // Check if this is a client domain
  const isClientDomain = clientDomains.some(clientDomain => 
    domain.includes(clientDomain.trim())
  );
  
  console.log(`Is client domain (for URL branding): ${isClientDomain}`);
  return isClientDomain;
}

/**
 * Get default MARA branding for emails
 * @returns {Object} Default MARA branding configuration
 */
function getDefaultBranding() {
  console.log('Using MARA default branding for email');
  
  // Show available environment variables for debugging
  const envVars = Object.keys(process.env)
    .filter(key => key.includes('LOGO') || key.includes('COMPANY') || key.includes('COLOR'))
    .filter(key => !key.includes('SECRET'));
  console.log('Available branding environment variables:', envVars.join(', '));
  
  // In Netlify functions, we use process.env directly
  const defaultLogo = process.env.DEFAULT_LOGO;
  const defaultName = process.env.DEFAULT_COMPANY_NAME;
  
  // Use Cloudinary URL for default logo if available
  const defaultLogoUrl = defaultLogo || 
                      'https://res.cloudinary.com/dwnh4b5sx/image/upload/v1741248008/branding/public/mara_logo_k4epmo.png';
  
  // Default branding
  return {
    logo: defaultLogoUrl,
    companyName: defaultName || 'MARA Maritime Risk Analysis',
    colors: {
      primary: process.env.DEFAULT_PRIMARY_COLOR || '#234567',
      secondary: process.env.DEFAULT_SECONDARY_COLOR || '#890123'
    }
  };
}

/**
 * Get client branding (kept for reference but not used in emails)
 * @returns {Object} Client branding configuration
 */
function getClientBranding() {
  console.log('Getting client branding (for reference)');
  
  const clientLogo = process.env.CLIENT_LOGO;
  const clientName = process.env.CLIENT_NAME;
  
  // Use Cloudinary URL for client logo if available
  const logoUrl = clientLogo || 
                'https://res.cloudinary.com/dwnh4b5sx/image/upload/v1741248008/branding/client/client_logo_vf7snt.png';
  
  return {
    logo: logoUrl,
    companyName: clientName || 'Atlas Bear Maritime',
    colors: {
      primary: process.env.CLIENT_PRIMARY_COLOR || '#0047AB',
      secondary: process.env.CLIENT_SECONDARY_COLOR || '#FF6B00'
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
 * Format coordinates in degrees, minutes, seconds format
 * @param {number} coordinate - The coordinate value (latitude or longitude)
 * @param {string} type - Either 'lat' or 'lon' to determine N/S or E/W
 * @returns {string} Formatted coordinate string
 */
function formatCoordinates(coordinate, type) {
  // Handle null or invalid coordinates
  if (coordinate === null || coordinate === undefined || isNaN(coordinate)) {
    return 'N/A';
  }
  
  // Determine if positive or negative
  const absolute = Math.abs(coordinate);
  
  // Convert to degrees, minutes, seconds
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
  
  // Format as string with directional indicator
  let direction = '';
  if (type === 'lat') {
    direction = coordinate >= 0 ? 'N' : 'S';
  } else {
    direction = coordinate >= 0 ? 'E' : 'W';
  }
  
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Generate HTML content for email
 * This version uses react-email to render our React EmailTemplate component
 * @param {Object} incident Incident data
 * @param {Object} branding Branding configuration
 * @param {Object} templateOverrides Template overrides
 * @param {string} publicUrl Public URL for viewing the report
 */
async function generateEmailHtml(incident, branding, templateOverrides = {}, publicUrl = null) {
  // Debug vessel data to ensure it's available
  console.log('GENERATE_EMAIL_HTML - RECEIVED VESSEL DATA:', {
    vesselName: incident.vesselName,
    vesselType: incident.vesselType,
    vesselFlag: incident.vesselFlag,
    vesselIMO: incident.vesselIMO
  });
  
  try {
    // Import the EmailTemplate component
    const EmailTemplateModule = await import('../src/apps/mara/components/FlashReport/EmailTemplate/index.jsx');
    const EmailTemplate = EmailTemplateModule.default;
    
    // Prepare the incident data in the format expected by the EmailTemplate component
    // The EmailTemplate expects a structure where incident data might be nested
    const templateData = {
      incident: incident,
      mapImageUrl: incident.mapImageUrl,
      publicUrl: publicUrl,
      
      // Transform the prepared incident data into the format expected by EmailTemplate
      incidentVessel: {
        fields: {
          vessel_status_during_incident: incident.status,
          crew_impact: incident.crewStatus
        }
      },
      
      // Include vessel data at the expected path
      vessel: {
        fields: {
          name: incident.vesselName,
          type: incident.vesselType,
          flag: incident.vesselFlag,
          imo: incident.vesselIMO
        }
      },
      
      // Include incident type data at the expected path
      incidentType: {
        fields: {
          name: incident.type
        }
      }
    };
    
    console.log('Rendering React component to HTML with react-email');
    
    // Use our utility function to render the React component to HTML
    const html = await renderReactEmailTemplate(EmailTemplate, {
      incident: templateData,
      branding: branding,
      publicUrl: publicUrl
    });
    
    console.log('React component rendered successfully');
    return html;
  } catch (error) {
    console.error('Error rendering EmailTemplate with react-email:', error);
    
    // Fallback to simple HTML template if there's an error
    console.log('Falling back to simple HTML template');
    
    // Simple fallback HTML template
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
            <p style="font-size: 14px; color: #4B5563; margin: 0; font-weight: 600;">
              <span style="display: inline-block; margin-right: 10px; color: #111827;">Type: <strong>${incident.vesselType || 'Unknown'}</strong></span> | 
              <span style="display: inline-block; margin: 0 10px; color: #111827;">IMO: <strong>${incident.vesselIMO || 'N/A'}</strong></span> | 
              <span style="display: inline-block; margin-left: 10px; color: #111827;">Flag: <strong>${incident.vesselFlag || 'N/A'}</strong></span>
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
        
        <!-- Map Image with fallback options -->
        ${incident.mapImageUrl ? 
          `<img src="${incident.mapImageUrl}" alt="Incident Location Map" style="display: block; width: 100%; max-width: 600px; height: auto; border-radius: 4px; border: 1px solid #E5E7EB;" 
                onerror="this.onerror=null; this.src='https://res.cloudinary.com/dwnh4b5sx/image/upload/maps/public/error-map.jpg';">` : 
          '<div style="width: 100%; height: 300px; background-color: #f3f4f6; border-radius: 4px; display: flex; justify-content: center; align-items: center; text-align: center; color: #6B7280;">Map image not available</div>'
        }
        
        <!-- Location name -->
        <p style="font-size: 16px; margin-top: 8px; text-align: center; font-weight: 600; color: #1F2937;">
          ${incident.location || 'Unknown location'}
        </p>
      </div>

      <!-- Incident Details -->
      <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
        <h2 style="font-size: 18px; font-weight: 600; color: ${branding.colors.primary}; margin-top: 0; margin-bottom: 16px;">Incident Details</h2>
        <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px;">
          <h3 style="font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827;">Description</h3>
          <p style="font-size: 14px; line-height: 1.5; color: #374151; margin: 0;">${incident.description}</p>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; padding: 0 24px 24px; text-align: center; color: #6B7280; font-size: 12px;">
        <p style="margin: 4px 0;">© ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.</p>
        <p style="margin: 4px 0;">This alert is confidential and for the intended recipient only.</p>
      </div>
    </body>
    </html>
    `;
  }
}