/**
 * Test function for weekly report notifications
 * This function is a testing endpoint for the weekly report notification system
 */

import { getSupabaseClient } from "./utils/supabase.js";
import { shouldUseClientBranding } from "./utils/supabase.js";
import { getEnv } from "./utils/environment.js";
import { renderEmailTemplate } from "./utils/email.js";
import { corsHeaders } from "./utils/environment.js";
import {
  getCurrentReportingWeek,
  getYearWeek,
} from "../src/shared/features/weekly-report/utils/dates.js";
import sgMail from "@sendgrid/mail";

/**
 * Main handler function for testing weekly report notifications
 * This is an HTTP endpoint that can be called to test the notification system
 */
export async function handler(event) {
  try {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    // Parse test parameters from the request body
    let userIds = [];
    let includeClientExample = false;
    let sendClientVersion = false;

    if (event.body) {
      try {
        const payload = JSON.parse(event.body);
        userIds = payload.userIds || [];
        includeClientExample = payload.includeClientExample === true;
        sendClientVersion = payload.sendClientVersion === true;

        console.log(`User IDs: ${userIds.join(", ") || "None specified"}`);
        console.log(
          `Include client example: ${includeClientExample ? "YES" : "NO"}`
        );
        console.log(
          `Send client version to test email: ${sendClientVersion ? "YES" : "NO"}`
        );
      } catch (e) {
        console.error("Error parsing test parameters:", e);
      }
    }

    if (!userIds.length) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "userIds array is required" }),
      };
    }

    console.log(
      `Weekly report notification test triggered for users: ${userIds.join(", ")}`
    );

    // Initialize SendGrid client
    const apiKey = getEnv("SENDGRID_API_KEY");
    if (!apiKey) {
      console.error("SendGrid API key is missing");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Email service configuration error" }),
      };
    }
    sgMail.setApiKey(apiKey);

    // Get current reporting week dates
    const { start, end } = getCurrentReportingWeek();
    const { year, week } = getYearWeek(end);
    const yearWeekCode = `${year}-${week.toString().padStart(2, "0")}`;

    console.log(
      `Testing notifications for report ${yearWeekCode} (${start.toISOString()} to ${end.toISOString()})`
    );

    // Get from email from environment variables
    const fromEmail = getEnv("SENDGRID_FROM_EMAIL", "mara@atlasbear.co");

    // Get recipients from Supabase based on user IDs
    const recipients = await getWeeklyReportRecipients(userIds);

    if (!recipients || recipients.length === 0) {
      console.log("No recipients found for the specified user IDs");
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "No recipients found",
          message: "Could not find any users with the specified IDs",
        }),
      };
    }

    let skippedRecipients = [];

    // If requested, create a simulated client domain recipient for demo
    if (includeClientExample) {
      // Get client domains to create an example
      const clientDomains = (getEnv("CLIENT_DOMAINS") || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      if (clientDomains.length > 0) {
        // Create an example object to show what would be sent to client domain users
        const clientDomain = clientDomains[0];
        const exampleClientEmail = `example@${clientDomain}`;

        skippedRecipients = [
          {
            email: exampleClientEmail,
            name: "Example Client User",
            metadata: { userId: "example-client", preferences: {} },
          },
        ];
      }
    }

    // Get branding for email
    const defaultBranding = getDefaultBranding();

    // Get public URL from environment
    const publicUrl = getEnv("PUBLIC_URL");
    const clientReportUrl = getEnv("CLIENT_REPORT_URL");

    if (!publicUrl) {
      console.error("PUBLIC_URL environment variable is missing");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Configuration error - missing PUBLIC_URL",
        }),
      };
    }

    // Format date range for display
    const dateRange = formatDateRange(start, end);

    // Create examples for client domains even if not explicitly requested
    let clientDomainExamples = [];

    // Get client domains to create examples
    const clientDomains = (getEnv("CLIENT_DOMAINS") || "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    if (clientDomains.length > 0) {
      // Create example objects to show what would be sent to client domain users
      clientDomainExamples = clientDomains.map((domain) => ({
        email: `example@${domain}`,
        name: `Example ${domain} User`,
        metadata: { userId: `example-${domain}`, preferences: {} },
      }));

      console.log(
        `Created ${clientDomainExamples.length} client domain examples`
      );
    }

    // Prepare examples of what would be sent to client domains
    const clientDomainInfo = await Promise.all(
      clientDomainExamples.map(async (recipient) => {
        try {
          // Client domains should always use client branding
          const useClientBranding = true;

          // Should always use client URL for these examples
          let reportUrl;
          if (clientReportUrl) {
            reportUrl = `${clientReportUrl}/${yearWeekCode}`;
          } else {
            reportUrl = `${publicUrl}/weekly-report/${yearWeekCode}`;
          }

          // Generate a sample of the email HTML that would be sent
          const emailData = {
            weekNumber: week,
            year,
            yearWeek: yearWeekCode,
            dateRange,
            reportUrl,
          };

          const html = generateWeeklyReportEmailHtml(
            emailData,
            defaultBranding
          );

          return {
            email: recipient.email,
            status: "would-send",
            reportUrl,
            useClientBranding,
            emailSubject: `Weekly Maritime Security Report - ${dateRange}`,
            // Include a preview of the html that would be sent
            emailPreview: html.substring(0, 500) + "... [truncated]",
          };
        } catch (error) {
          return {
            email: recipient.email,
            status: "failed",
            error: error.message,
          };
        }
      })
    );

    // Send emails to the test recipient
    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          // Get email content for standard version
          const useClientBranding = shouldUseClientBranding(recipient.email);

          // Determine which URL to use based on email domain
          let reportUrl;
          if (useClientBranding && clientReportUrl) {
            reportUrl = `${clientReportUrl}/${yearWeekCode}`;
          } else {
            reportUrl = `${publicUrl}/weekly-report/${yearWeekCode}`;
          }

          const emailData = {
            weekNumber: week,
            year,
            yearWeek: yearWeekCode,
            dateRange,
            reportUrl,
          };

          const html = generateWeeklyReportEmailHtml(
            emailData,
            defaultBranding
          );

          // Create subject line for standard version
          const subject = `Weekly Maritime Security Report - ${dateRange}`;

          // Send standard version email
          const emailMessage = {
            to: recipient.email,
            from: {
              email: fromEmail,
              name: defaultBranding.companyName,
            },
            subject,
            html,
            categories: ["test", "weekly-report", "maritime"],
          };

          const [response] = await sgMail.send(emailMessage);

          console.log(
            `Standard test notification sent to ${recipient.email}: ${response.statusCode}`
          );

          // Track results
          const result = {
            email: recipient.email,
            version: "standard",
            status: "sent",
            statusCode: response.statusCode,
            reportUrl,
            useClientBranding,
          };

          // If requested, also send the client version to the test email
          if (sendClientVersion && clientReportUrl) {
            try {
              // Create client version with client URL
              const clientReportUrlWithYearWeek = `${clientReportUrl}/${yearWeekCode}`;

              const clientEmailData = {
                weekNumber: week,
                year,
                yearWeek: yearWeekCode,
                dateRange,
                reportUrl: clientReportUrlWithYearWeek,
              };

              const clientHtml = generateWeeklyReportEmailHtml(
                clientEmailData,
                defaultBranding
              );

              // Create subject line for client version
              const clientSubject = `[TEST-CLIENT] Weekly Maritime Security Report - ${dateRange}`;

              // Send client version email
              const clientEmailMessage = {
                to: recipient.email,
                from: {
                  email: fromEmail,
                  name: defaultBranding.companyName,
                },
                subject: clientSubject,
                html: clientHtml,
                categories: ["test", "client", "weekly-report", "maritime"],
              };

              const [clientResponse] = await sgMail.send(clientEmailMessage);

              console.log(
                `Client test notification also sent to ${recipient.email}: ${clientResponse.statusCode}`
              );

              // Add client version to results
              return [
                result,
                {
                  email: recipient.email,
                  version: "client",
                  status: "sent",
                  statusCode: clientResponse.statusCode,
                  reportUrl: clientReportUrlWithYearWeek,
                  useClientBranding: true,
                },
              ];
            } catch (clientError) {
              console.error(
                `Error sending client version to ${recipient.email}:`,
                clientError
              );
              return [
                result,
                {
                  email: recipient.email,
                  version: "client",
                  status: "failed",
                  error: clientError.message,
                },
              ];
            }
          }

          return result;
        } catch (error) {
          console.error(`Error sending to ${recipient.email}:`, error);
          return {
            email: recipient.email,
            version: "standard",
            status: "failed",
            error: error.message,
          };
        }
      })
    );

    // Flatten results array since some items might be arrays now
    const flatResults = results.flat();

    // Return success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Weekly report test notification sent",
        yearWeek: yearWeekCode,
        dateRange,
        sentCount: flatResults.filter((r) => r.status === "sent").length,
        failedCount: flatResults.filter((r) => r.status === "failed").length,
        results: flatResults,
        clientDomainInfo:
          clientDomainInfo.length > 0
            ? {
                message:
                  "The following shows what would be sent to users with client domains",
                domains: clientDomains,
                examples: clientDomainInfo,
              }
            : null,
      }),
    };
  } catch (error) {
    console.error("Error in weekly report test notification function:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Error sending test notification",
        message: error.message,
      }),
    };
  }
}

/**
 * Fetch specific recipients for weekly report from Supabase
 * Gets users by their IDs
 * @param {Array<string>} userIds - Array of user IDs to fetch
 * @returns {Promise<Array>} Array of recipient objects with email
 */
async function getWeeklyReportRecipients(userIds) {
  const supabase = getSupabaseClient();

  try {
    console.log("Fetching specific weekly report recipients from Supabase");

    // Query users by their IDs
    const { data, error } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, preferences")
      .in("id", userIds);

    if (error) {
      console.error("Error fetching weekly report recipients:", error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} recipients`);

    if (!data || data.length === 0) {
      return [];
    }

    // Format recipients
    return data.map((user) => ({
      email: user.email,
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      metadata: {
        userId: user.id,
        preferences: user.preferences || {},
      },
    }));
  } catch (error) {
    console.error("Error in getWeeklyReportRecipients:", error);
    throw error;
  }
}

/**
 * Format a date range for display
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {string} Formatted date range
 */
function formatDateRange(start, end) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return `${start.toLocaleDateString(
    "en-GB",
    options
  )} - ${end.toLocaleDateString("en-GB", options)}`;
}

/**
 * Get default MARA branding for emails
 * @returns {Object} Default MARA branding configuration
 */
function getDefaultBranding() {
  // Use environment variables for branding configuration
  const defaultLogo = getEnv(
    "DEFAULT_LOGO",
    "https://res.cloudinary.com/dwnh4b5sx/image/upload/v1741248008/branding/public/mara_logo_k4epmo.png"
  );
  const defaultName = getEnv(
    "DEFAULT_COMPANY_NAME",
    "MARA Maritime Risk Analysis"
  );

  return {
    logo: defaultLogo,
    companyName: defaultName,
    colors: {
      primary: getEnv("DEFAULT_PRIMARY_COLOR", "#234567"),
      secondary: getEnv("DEFAULT_SECONDARY_COLOR", "#890123"),
    },
  };
}

/**
 * Generate HTML for weekly report notification email
 * Uses similar styling as the flash report email for consistency
 * @param {Object} data - Data for email template
 * @param {Object} branding - Branding information
 * @returns {string} Rendered HTML
 */
function generateWeeklyReportEmailHtml(data, branding) {
  const { weekNumber, year, yearWeek, dateRange, reportUrl } = data;
  const { logo, companyName, colors } = branding;
  const primaryColor = colors.primary;
  const secondaryColor = colors.secondary;
  const currentYear = new Date().getFullYear();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Weekly Maritime Security Report</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
    <!-- Logo/Branding Section - Outside the card -->
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logo}" alt="${companyName}" style="max-width: 180px; height: auto;">
    </div>
    
    <!-- Main Content Card with Shadow -->
    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);">
    
      <!-- Header Section -->
      <div style="background-color: #F0F9FF; padding: 24px; border-bottom: 1px solid #DBEAFE;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <span style="display: inline-block; padding: 4px 10px; background-color: #EFF6FF; border-radius: 9999px; color: #1E40AF; font-size: 14px; font-weight: bold;">Week ${weekNumber}</span>
              <span style="display: inline-block; padding: 4px 10px; background-color: #F0FDF4; border-radius: 9999px; color: #166534; font-size: 14px; font-weight: bold;">${year}</span>
            </div>
            <h1 style="font-size: 24px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; color: ${primaryColor};">
              Weekly Maritime Security Report
            </h1>
            <p style="font-size: 14px; color: #4B5563; margin: 0;">
              ${dateRange}
            </p>
          </div>
        </div>
      </div>

      <!-- Notification Message -->
      <div style="padding: 24px; border-bottom: 1px solid #E5E7EB;">
        <h2 style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Weekly Report Now Available</h2>
        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          The weekly maritime security report for ${dateRange} is now available. This report provides a comprehensive overview of maritime security incidents and analysis for the past week.
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          Key features of this report include:
        </p>
        <ul style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
          <li>Executive brief of the past week's activities</li>
          <li>Regional analysis and incident details</li>
          <li>Security recommendations for maritime operations</li>
          <li>Incident maps and spatial analysis</li>
        </ul>
      </div>

      <!-- View Online Button -->
      <div style="padding: 24px; text-align: center;">
        <a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: white; font-weight: 600; text-decoration: none; border-radius: 6px;">
          View Weekly Report
        </a>
        <p style="font-size: 14px; color: #6B7280; margin-top: 12px;">
          Click the button above to view the complete weekly report for ${dateRange}.
        </p>
      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; padding: 20px 24px 24px; text-align: center; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 4px 0;">© ${currentYear} ${companyName}. All rights reserved.</p>
        <p style="margin: 4px 0;">You're receiving this email because you subscribed to weekly maritime security reports.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}
