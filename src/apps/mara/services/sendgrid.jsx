import sgMail from '@sendgrid/mail';
import React from 'react';
import { renderToString } from 'react-dom/server';
import EmailTemplate from '../components/FlashReport/EmailTemplate';
import { generateMapImage } from './staticMap.jsx';

// Initialize SendGrid with API key (using import.meta.env for browser environment)
const apiKey = import.meta.env.VITE_SENDGRID_API_KEY || '';

// Only set the API key if it's a real key (starting with SG.)
// This prevents warnings in development/preview mode
if (apiKey && apiKey.startsWith('SG.')) {
  sgMail.setApiKey(apiKey);
} else {
  console.log('SendGrid API key not properly configured - email sending disabled');
}

/**
 * Get branding configuration based on recipient email domain
 * @param {string} email Recipient email address
 * @returns {Object} Branding configuration
 */
export const getBrandingForEmail = (email) => {
  if (!email) return null;

  // Extract domain from email
  const domain = email.split('@')[1];
  
  // Domain-based branding mapping
  const brandingMap = {
    'clientdomain.com': {
      logo: process.env.VITE_CLIENT_LOGO || 'https://example.com/client-logo.png',
      companyName: process.env.VITE_CLIENT_NAME || 'Client Company',
      colors: {
        primary: process.env.VITE_CLIENT_PRIMARY_COLOR || '#0047AB',
        secondary: process.env.VITE_CLIENT_SECONDARY_COLOR || '#FF6B00'
      }
    }
  };
  
  return brandingMap[domain] || null;
};

/**
 * Send a flash report email using SendGrid
 * @param {Object} incident Incident data
 * @param {Array} recipients Array of recipient email addresses
 * @param {Object} options Additional options like CC, BCC, etc.
 * @returns {Promise} SendGrid response
 */
export const sendFlashReport = async (incident, recipients, options = {}) => {
  try {
    if (!incident) {
      throw new Error('Incident data is required');
    }
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('At least one recipient email is required');
    }

    // Generate a static map image for the incident via Cloudinary
    let mapImageUrl = '';
    try {
      mapImageUrl = await generateMapImage({
        latitude: incident.incident?.fields?.latitude || incident.coordinates?.latitude,
        longitude: incident.incident?.fields?.longitude || incident.coordinates?.longitude,
        zoom: 5,
        incidentType: incident.incidentType?.fields?.name || incident.type
      });
    } catch (mapError) {
      console.error('Error generating map image:', mapError);
      // Continue without map image if there's an error
    }
    
    // Add the map image URL to the incident data
    const incidentWithMap = { ...incident, mapImageUrl };
    
    // Prepare personalized emails for each recipient
    const emails = recipients.map(recipient => {
      // Get branding for this recipient
      const branding = getBrandingForEmail(recipient);
      
      // Create subject line
      const vesselName = incident.vesselName || 
                        incident.incident?.fields?.vesselName || 
                        'Vessel';
      const subject = `🚨 MARITIME ALERT: ${vesselName} Incident`;
      
      // Render React component to HTML
      const htmlContent = renderToString(
        <EmailTemplate incident={incidentWithMap} branding={branding || {}} />
      );
      
      // Create email object
      return {
        to: recipient,
        from: options.from || {
          email: import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'alerts@example.com',
          name: branding?.companyName || 'Maritime Risk Analysis'
        },
        subject,
        html: htmlContent,
        // Optional CC and BCC
        ...(options.cc && { cc: options.cc }),
        ...(options.bcc && { bcc: options.bcc }),
        // SendGrid category for analytics
        categories: ['flash-report', 'maritime', 'incident'],
        customArgs: {
          incident_id: incident.id || incident.incident?.fields?.id
        }
      };
    });
    
    // Send all emails
    return await sgMail.send(emails);
  } catch (error) {
    console.error('Error sending flash report:', error);
    throw error;
  }
};