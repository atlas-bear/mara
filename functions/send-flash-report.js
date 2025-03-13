import sgMail from '@sendgrid/mail';
import axios from 'axios';
import { getIncident } from './utils/incident-utils.js';
import { getCachedIncident } from './utils/incident-cache.js';
import { getVesselByIMO, getVesselByName, getVesselById } from './utils/vessel-utils.js';
import { validateData } from './utils/validation.js';
import { corsHeaders } from './utils/environment.js';
import { generateFlashReportToken, getPublicFlashReportUrl } from './utils/token-utils.js';
import { renderEmailTemplate } from './utils/email.js';

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
    // The empty object is a fallback to ensure it's never undefined
    let vesselData = {
      name: null,
      type: null,
      flag: null,
      imo: null
    };
    
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
    
    // Check if incident data was directly provided in the payload
    if (payload.incident && typeof payload.incident === 'object') {
      console.log('Using incident data directly from payload');
      incidentData = payload.incident;
      
      // If coordinates are provided directly, extract them
      if (incidentData.coordinates) {
        if (incidentData.coordinates.latitude) {
          incidentData.latitude = incidentData.coordinates.latitude;
        }
        if (incidentData.coordinates.longitude) {
          incidentData.longitude = incidentData.coordinates.longitude;
        }
      }
      
      // Log what we received directly from client
      console.log('INCIDENT DATA FROM CLIENT:');
      console.log('- id:', incidentData.id);
      console.log('- vesselName:', incidentData.vesselName);
      console.log('- vesselType:', incidentData.vesselType); 
      console.log('- vesselFlag:', incidentData.vesselFlag);
      console.log('- vesselIMO:', incidentData.vesselIMO);
      console.log('- status:', incidentData.status);
      console.log('- crewStatus:', incidentData.crewStatus);
    } else {
      console.log('No incident data in payload, will query Airtable');
    }
    
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
      // Skip Airtable fetch if we already have data from the client
      if (!incidentData) {
        // Try to get cached incident data
        try {
          console.log('Attempting to fetch incident data from cache...');
          // Use our new caching layer for consistent data
          let cachedData = await getCachedIncident(incidentId);
          
          if (cachedData) {
            console.log('Cached data fetch successful!');
            console.log('DEBUG - Cached data content:', JSON.stringify(cachedData).substring(0, 500));
            
            // Enhanced debugging for vessel data structure
            console.log('VESSEL DATA STRUCTURE CHECK:');
            console.log('- Has nested property:', !!cachedData.nested);
            if (cachedData.nested) {
              console.log('- Has nested.vessel property:', !!cachedData.nested.vessel);
              if (cachedData.nested.vessel) {
                console.log('- nested.vessel structure:', JSON.stringify(cachedData.nested.vessel).substring(0, 200));
                console.log('- Has nested.vessel.fields?', !!cachedData.nested.vessel.fields);
                if (cachedData.nested.vessel.fields) {
                  console.log('- vessel fields:', Object.keys(cachedData.nested.vessel.fields).join(', '));
                }
              }
            }
            
            // Validate cache data is usable
            if (!cachedData.nested || 
                !cachedData.nested.incident || 
                !cachedData.nested.incident.fields || 
                Object.keys(cachedData.nested.incident.fields).length === 0) {
              console.error('Invalid or empty cached data structure, forcing refresh...');
              
              // Force a refresh to get fresh data
              const refreshedData = await getCachedIncident(incidentId, { forceRefresh: true });
              if (!refreshedData || !refreshedData.nested || !refreshedData.nested.incident) {
                console.error('Still unable to get valid data after force refresh');
                throw new Error('Unable to get valid incident data');
              }
              console.log('Successfully refreshed cached data');
              // Use the refreshed data
              cachedData = refreshedData;
            }
            
            // Extract data using the standardized structure
            // For backward compatibility, use the nested structure
            if (cachedData.nested) {
              console.log('Using standardized nested data structure');
              
              // Extract the data components from the standardized nested structure
              incidentData = cachedData.nested.incident.fields || {};
              // Add optional chaining to handle null nested objects
              const fetchedVesselData = cachedData.nested.vessel?.fields || {};
              const fetchedIncidentVesselData = cachedData.nested.incidentVessel?.fields || {}; 
              const incidentTypeData = cachedData.nested.incidentType?.fields || {};
              
              // Log what we found
              console.log('Incident data:', Object.keys(incidentData).join(', '));
              console.log('Vessel data:', fetchedVesselData ? Object.keys(fetchedVesselData).join(', ') : 'none');
              console.log('Incident Vessel data:', fetchedIncidentVesselData ? Object.keys(fetchedIncidentVesselData).join(', ') : 'none');
              console.log('Incident type data:', incidentTypeData ? Object.keys(incidentTypeData).join(', ') : 'none');
              
              // Combine data for easier access in the template
              // Update vesselData with data from relationship
              // Make a deep copy to prevent reference issues
              vesselData = { ...fetchedVesselData };
              console.log('DEEP COPY OF VESSEL DATA:', JSON.stringify(vesselData));
              const incidentVesselData = { ...fetchedIncidentVesselData };
              
              // Add vessel status and crew impact from incident_vessel if available
              if (incidentVesselData) {
                if (incidentVesselData.vessel_status_during_incident) {
                  incidentData.vessel_status_during_incident = incidentVesselData.vessel_status_during_incident;
                  console.log('Adding vessel_status_during_incident:', incidentVesselData.vessel_status_during_incident);
                }
                if (incidentVesselData.crew_impact) {
                  incidentData.crew_impact = incidentVesselData.crew_impact;
                  console.log('Adding crew_impact:', incidentVesselData.crew_impact);
                }
                if (incidentVesselData.damage_sustained) {
                  incidentData.damage_sustained = incidentVesselData.damage_sustained;
                  console.log('Adding damage_sustained:', incidentVesselData.damage_sustained);
                }
                console.log('Added incident_vessel data to incident record');
              } else {
                console.warn('No incident_vessel data available to add to incident record');
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
              // If for some reason we don't have the nested structure, use flat data directly
              console.log('Using flat data structure from cache');
              
              // Create the structure expected by the rest of the function
              incidentData = {
                id: cachedData.id,
                title: cachedData.title,
                description: cachedData.description,
                date_time_utc: cachedData.date,
                location_name: cachedData.location,
                latitude: cachedData.coordinates?.latitude,
                longitude: cachedData.coordinates?.longitude,
                vessel_status_during_incident: cachedData.status,
                crew_impact: cachedData.crewStatus,
                analysis: cachedData.analysis,
                recommendations: cachedData.recommendations,
                map_image_url: cachedData.mapImageUrl,
                incident_type_name: cachedData.type
              };
              
              // Set up vessel data
              vesselData = {
                name: cachedData.vesselName,
                type: cachedData.vesselType,
                flag: cachedData.vesselFlag,
                imo: cachedData.vesselIMO
              };
              
              console.log('Constructed incident data from flat structure');
            }
          } else {
            console.log('No data found in cache, falling back to direct Airtable fetch');
            
            // Fall back to direct Airtable fetch if cache fails
            try {
              console.log('Attempting to fetch incident data directly from Airtable...');
              const airtableData = await getIncident(incidentId);
              
              if (airtableData) {
                console.log('Airtable direct fetch successful!');
                
                // Use the same data extraction as before, but handle fields correctly
                incidentData = airtableData.incident?.fields || airtableData.incident || {};
                
                // CRITICAL: Make sure we get vessel fields properly
                if (airtableData.vessel) {
                  console.log('DEBUG: Direct Airtable vessel data:', JSON.stringify(airtableData.vessel).substring(0, 200));
                  vesselData = airtableData.vessel.fields || airtableData.vessel || {};
                  console.log('DEBUG: Extracted vessel data:', JSON.stringify(vesselData));
                } else {
                  console.log('No vessel data from direct Airtable fetch');
                  vesselData = {};
                }
                
                const incidentVesselData = airtableData.incidentVessel?.fields || airtableData.incidentVessel || {};
                const incidentTypeData = airtableData.incidentType?.fields || airtableData.incidentType || {};
                
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
                }
                
                // Add incident type info to incident data
                if (incidentTypeData && incidentTypeData.name) {
                  incidentData.incident_type_name = incidentTypeData.name;
                }
              }
            } catch (airtableError) {
              console.warn('Both cache and direct Airtable fetch failed:', airtableError.message);
            }
          }
        } catch (cacheError) {
          console.warn('Error fetching from cache:', cacheError.message);
          console.log('Sample incident ID check:', incidentId, 'Matches?', incidentId === '2025-0010');
          
          // If cache fetch fails and this is the sample incident ID, use sample data
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
      } else {
        console.log('Using client-provided incident data, skipping Airtable fetch');
        
        // Create vessel data from the client-provided incident data
        vesselData = {
          name: incidentData.vesselName,
          type: incidentData.vesselType,
          flag: incidentData.vesselFlag,
          imo: incidentData.vesselIMO
        };
        
        console.log('Created vessel data from client data:', JSON.stringify(vesselData));
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
    
    // Add additional debug logging for vessel data
    console.log('VESSEL DATA FINAL CHECK:');
    console.log('- enhancedVesselData:', JSON.stringify(enhancedVesselData));
    console.log('- vessel_status_during_incident:', incidentData.vessel_status_during_incident || 'not found');
    console.log('- crew_impact:', incidentData.crew_impact || 'not found');
    console.log('- status (for fallback):', incidentData.status || 'not found');
    console.log('- crewStatus (for fallback):', incidentData.crewStatus || 'not found');
    
    // Prepare incident data for email, aligning with the IncidentDetails component structure
    const preparedIncident = {
      id: incidentData.id,
      type: incidentType,
      date: incidentData.date_time_utc || incidentData.date,
      location: incidentData.location_name || incidentData.location || 'Unknown Location',
      coordinates: {
        latitude: latitude !== null && !isNaN(latitude) ? parseFloat(latitude) : 0,
        longitude: longitude !== null && !isNaN(longitude) ? parseFloat(longitude) : 0
      },
      // Vessel data from the vessel table using enhancedVesselData
      vesselName: enhancedVesselData.name || 'Unknown Vessel',
      vesselType: enhancedVesselData.type || 'Unknown',
      vesselFlag: enhancedVesselData.flag || 'Unknown',
      vesselIMO: enhancedVesselData.imo || 'N/A',
      
      // Use vessel_status_during_incident from incidentData, falling back to status (client-side name)
      vessel_status_during_incident: incidentData.vessel_status_during_incident || incidentData.status || 'Unknown Status',
      
      destination: incidentData.vessel_destination || incidentData.destination || 'Unknown Destination',
      
      // Use crew_impact from incidentData, falling back to crewStatus (client-side name)
      crew_impact: incidentData.crew_impact || incidentData.crewStatus || 'No information available',
      
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
        
        // Create email subject with direct injection of vessel name
        // Use direct string substitution for highest reliability
        const subject = `🚨 MARITIME ALERT: TEST-VESSEL-NAME=${preparedIncident.vesselName} / TYPE=${preparedIncident.vesselType}`;
        
        // Create HTML content with public link
        // Before sending, log the vessel data one final time to verify
        console.log('DEBUG - VESSEL DATA BEING SENT TO EMAIL:', {
          vesselName: preparedIncident.vesselName,
          vesselType: preparedIncident.vesselType,
          vesselFlag: preparedIncident.vesselFlag,
          vesselIMO: preparedIncident.vesselIMO
        });
        
        // Log what data we have available
        console.log('DATA AVAILABLE FOR EMAIL:');
        console.log('- incidentData has keys:', incidentData ? Object.keys(incidentData).join(', ') : 'no data');
        console.log('- Does client directly provide incident?', !!payload.incident);
        
        // Create the right data structure for the email template
        let templateData;
        
        // The client directly sends data in the payload.incident object
        if (payload.incident) {
          console.log('USING CLIENT-PROVIDED INCIDENT DATA');
          console.log('- Client vessel name:', payload.incident.vesselName);
          console.log('- Client vessel status:', payload.incident.status);
          console.log('- Client crew status:', payload.incident.crewStatus);
          
          // Prepare the data structure exactly like the IncidentDetails component expects
          // but using the client-provided data which has different field names
          
          // Create a specific vessel data object with guaranteed values (not undefined)
          const clientVesselData = {
            name: payload.incident.vesselName || 'Unknown Vessel',
            type: payload.incident.vesselType || 'Unknown',
            flag: payload.incident.vesselFlag || 'Unknown',
            imo: payload.incident.vesselIMO || 'N/A'
          };
          
          console.log('CLIENT PROVIDED VESSEL DATA:', JSON.stringify(clientVesselData));
          
          templateData = {
            incident: {
              incident: { 
                fields: { 
                  id: payload.incident.id, 
                  title: payload.incident.title,
                  description: payload.incident.description,
                  map_image_url: payload.incident.map_image_url,
                  analysis: payload.incident.analysis,
                  recommendations: payload.incident.recommendations,
                  date_time_utc: payload.incident.date,
                  location_name: payload.incident.location,
                  latitude: payload.incident.coordinates?.latitude,
                  longitude: payload.incident.coordinates?.longitude
                } 
              },
              vessel: { 
                fields: clientVesselData
              },
              incidentVessel: { 
                fields: {
                  vessel_status_during_incident: payload.incident.status,
                  crew_impact: payload.incident.crewStatus
                } 
              },
              incidentType: { 
                fields: { 
                  name: payload.incident.type 
                } 
              }
            },
            branding: branding,
            publicUrl: publicUrl
          };
          
          // Log the newly structured data
          console.log('CLIENT DATA - Key fields:');
          console.log('- Vessel name:', templateData.incident.vessel.fields.name);
          console.log('- Vessel status:', templateData.incident.incidentVessel.fields.vessel_status_during_incident);
          console.log('- Crew status:', templateData.incident.incidentVessel.fields.crew_impact);
        } else {
          // Using server-fetched data
          console.log('USING SERVER-FETCHED INCIDENT DATA');
          
          // Create proper incidentVessel fields object 
          const incidentVesselFields = {};
          if (incidentData.vessel_status_during_incident) {
            incidentVesselFields.vessel_status_during_incident = incidentData.vessel_status_during_incident;
          }
          if (incidentData.crew_impact) {
            incidentVesselFields.crew_impact = incidentData.crew_impact;
          }
          
          // IMPORTANT: For server-side data, we need to ensure vesselData exists and has required fields
          // This is critical for the email template to work correctly
          console.log('VESSEL DATA VALIDATION FOR EMAIL:');
          console.log('- Initial vessel data:', JSON.stringify(vesselData || {}));
          console.log('- Enhanced vessel data:', JSON.stringify(enhancedVesselData || {}));
          
          // If vesselData is missing or empty, but we have enhancedVesselData, use that first
          if ((!vesselData || Object.keys(vesselData).length === 0) && enhancedVesselData && Object.keys(enhancedVesselData).length > 0) {
            console.log('⚠️ Using enhanced vessel data instead of empty vesselData');
            vesselData = { ...enhancedVesselData };
          }
          // If we still don't have vessel data, create it from preparedIncident
          // This ensures we always have vessel data in the email
          else if (!vesselData || Object.keys(vesselData).length === 0) {
            console.log('⚠️ vesselData missing or empty, using prepared data instead');
            vesselData = {
              name: preparedIncident.vesselName,
              type: preparedIncident.vesselType,
              flag: preparedIncident.vesselFlag,
              imo: preparedIncident.vesselIMO
            };
          }
          
          // Final validation - ensure we have at least a vessel name
          if (!vesselData.name && preparedIncident.vesselName) {
            console.log('⚠️ vesselData.name missing, using prepared data');
            vesselData.name = preparedIncident.vesselName;
          }
          
          // Log what's available after fixes
          console.log('- Final vessel name:', vesselData?.name);
          console.log('- Final vessel type:', vesselData?.type);
          console.log('- Final vessel flag:', vesselData?.flag);
          console.log('- Final vessel IMO:', vesselData?.imo);
          console.log('- Final vessel status:', incidentVesselFields.vessel_status_during_incident);
          console.log('- Final crew status:', incidentVesselFields.crew_impact);
          
          // Prepare the data structure with server-fetched data
          // IMPORTANT: Use the enhancedVesselData instead of the old vesselData
          // This ensures the email has access to the vessel data from all lookup methods
          // CRITICAL FIX: Copy the prepared vessel data directly (not reference)
          const emailVesselData = {
            name: preparedIncident.vesselName,
            type: preparedIncident.vesselType,
            flag: preparedIncident.vesselFlag,
            imo: preparedIncident.vesselIMO
          };
          
          // Log the vessel data we're using for email
          console.log('VESSEL DATA BEFORE EMAIL TEMPLATE:');
          console.log(JSON.stringify(emailVesselData));
          
          templateData = {
            incident: {
              incident: { fields: incidentData },
              vessel: { fields: emailVesselData }, // Use directly prepared data
              incidentVessel: { fields: incidentVesselFields },
              incidentType: { fields: { name: incidentType } }
            },
            branding: branding,
            publicUrl: publicUrl
          };
        }
        
        // Add detailed debug logging before sending to email renderer
        console.log('FINAL EMAIL TEMPLATE DATA STRUCTURE:');
        console.log('- vessel data sent to email:', JSON.stringify(templateData.incident.vessel.fields));
        console.log('- vessel name:', templateData.incident.vessel.fields.name);
        console.log('- vessel type:', templateData.incident.vessel.fields.type);
        console.log('- vessel flag:', templateData.incident.vessel.fields.flag);
        
        // Add special vessel debug check directly before email generation
        // Log all vessel data for debugging
        console.log('FINAL VESSEL DATA CHECK BEFORE RENDERING:');
        console.log('- Template vessel data:', JSON.stringify(templateData.incident.vessel.fields));
        console.log('- Vessel name:', templateData.incident.vessel.fields.name);
        console.log('- preparedIncident vessel name:', preparedIncident.vesselName);
        
        // Generate HTML using the standardized structure
        // But with a direct vessel name injection for this test
        let htmlContent;
        
        // Use the prepare email helper, but with debug info directly in the email
        try {
          htmlContent = await generateEmailHtml(
            templateData, 
            templateOverrides
          );
          
          // Inject the vessel name directly into the html content for testing
          // At the top of the body, add a debug section with the vessel data
          const debugInfo = `
          <div style="background-color: #f8f9fa; padding: 10px; margin: 20px; border: 1px solid #dee2e6;">
            <h2 style="margin-top: 0; color: red;">DIRECT VESSEL DATA INJECTION FOR DEBUGGING</h2>
            <p style="font-size: 16px;"><strong>Vessel Name:</strong> ${preparedIncident.vesselName}</p>
            <p style="font-size: 16px;"><strong>Vessel Type:</strong> ${preparedIncident.vesselType}</p>
            <p style="font-size: 16px;"><strong>Vessel Flag:</strong> ${preparedIncident.vesselFlag}</p>
            <p style="font-size: 16px;"><strong>Vessel IMO:</strong> ${preparedIncident.vesselIMO}</p>
            <p style="font-size: 16px;"><strong>Template Vessel Data:</strong> ${JSON.stringify(templateData.incident.vessel.fields)}</p>
            <hr style="border: 1px solid #f3f3f3;">
            <p style="font-size: 16px;">If you see this section but not the vessel data in the email template above, there's an issue with how the template is processing the data.</p>
          </div>
          `;
          
          // Insert debugInfo right after the body tag
          // Make sure to insert after the opening body tag
          htmlContent = htmlContent.replace('<body', '<body');
          htmlContent = htmlContent.replace('<body style=', debugInfo + '<body style=');
          
          console.log('Added debug vessel info to email HTML');
        } catch (error) {
          console.error('Error generating HTML with debug info:', error);
          // Fallback to standard template
          htmlContent = await generateEmailHtml(
            templateData, 
            templateOverrides
          );
        }
        
        // Create email object - renamed to avoid variable collision
        const sendGridEmailData = {
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
          console.log(`From: ${sendGridEmailData.from.email} (${sendGridEmailData.from.name})`);
          console.log(`To: ${sendGridEmailData.to}`);
          console.log(`Subject: ${sendGridEmailData.subject}`);
          console.log(`Public URL in email: ${publicUrl}`);
          
          // Send email
          await sgMail.send(sendGridEmailData);
          
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
 * This function passes the data to the email template renderer
 * @param {Object} data Full data structure for the email template
 * @param {Object} templateOverrides Template overrides
 * @returns {string} Generated HTML for the email
 */
async function generateEmailHtml(data, templateOverrides = {}) {
  // Debug data structure we're sending to the template
  console.log('GENERATE_EMAIL_HTML - RECEIVED DATA STRUCTURE FOR EMAIL');
  console.log('- Structure provided to generateEmailHtml:', Object.keys(data));
  
  try {
    console.log('Using lightweight HTML email template renderer');
    
    // Use the simple template renderer with the data structure
    // This matches what the IncidentDetails component expects
    const html = renderEmailTemplate(data);
    
    console.log('Email template rendered successfully');
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