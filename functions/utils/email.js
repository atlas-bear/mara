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
 * Renders a React component to HTML for emails using react-email
 * This is particularly useful for email templates
 * 
 * @param {Function} Component React component to render
 * @param {Object} props Props to pass to the component
 * @returns {Promise<string>} Rendered HTML
 */
export async function renderReactEmailTemplate(Component, props) {
  try {
    console.log('Attempting to render React component to email HTML');
    
    // Import required modules on demand
    const [React, { render }] = await Promise.all([
      import('react'),
      import('react-email/render')
    ]);
    
    // Check if the component is valid
    if (typeof Component !== 'function') {
      throw new Error('Invalid React component provided');
    }
    
    // Render the component to HTML
    const element = React.createElement(Component, props);
    const html = render(element);
    
    console.log('React component rendered to HTML successfully');
    return html;
  } catch (error) {
    console.error('Error rendering React component to HTML:', error);
    throw error;
  }
}