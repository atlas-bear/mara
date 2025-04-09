/**
 * Send a notification email when the weekly report is ready
 * This scheduled function runs every Tuesday at 08:00 UTC
 * to inform subscribers that the weekly report is available
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
 * Main handler function for sending weekly report notifications
 * This is triggered by Netlify's scheduled function runner
 */
export async function handler(event) {
  try {
    // Check if this is a scheduled trigger (when run by Netlify's scheduler)
    const isScheduled =
      event.headers && event.headers["x-netlify-event"] === "schedule";

    // Only allow scheduled events - this function is not meant to be called directly
    if (!isScheduled) {
      console.log(
        "This function is meant to be triggered by the scheduler only"
      );
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Method not allowed",
          message:
            "This function is only triggered by the scheduler. Use test-weekly-notification for testing.",
        }),
      };
    }

    console.log("Weekly report notification function triggered by scheduler");

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
      `Sending notifications for report ${yearWeekCode} (${start.toISOString()} to ${end.toISOString()})`
    );

    // Get from email from environment variables
    const fromEmail = getEnv("SENDGRID_FROM_EMAIL", "mara@atlasbear.co");

    // Get all recipients who have opted in for weekly reports
    const recipients = await getWeeklyReportRecipients();

    if (!recipients || recipients.length === 0) {
      console.log("No recipients found for weekly report notifications");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "No recipients found",
          yearWeek: yearWeekCode,
        }),
      };
    }

    console.log(
      `Found ${recipients.length} recipients for weekly report notification`
    );

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

    // Send emails to each recipient
    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          // Get email content
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

          // Create subject line
          const subject = `Weekly Maritime Security Report - ${dateRange}`;

          // Send email
          const emailMessage = {
            to: recipient.email,
            from: {
              email: fromEmail,
              name: defaultBranding.companyName,
            },
            subject,
            html,
            categories: ["weekly-report", "maritime"],
          };

          const [response] = await sgMail.send(emailMessage);

          console.log(
            `Weekly report notification sent to ${recipient.email}: ${response.statusCode}`
          );

          return {
            email: recipient.email,
            status: "sent",
            statusCode: response.statusCode,
          };
        } catch (error) {
          console.error(`Error sending to ${recipient.email}:`, error);
          return {
            email: recipient.email,
            status: "failed",
            error: error.message,
          };
        }
      })
    );

    // Return success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Weekly report notifications sent",
        yearWeek: yearWeekCode,
        dateRange,
        sentCount: results.filter((r) => r.status === "sent").length,
        failedCount: results.filter((r) => r.status === "failed").length,
        results,
      }),
    };
  } catch (error) {
    console.error("Error in weekly report notification function:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Error sending weekly report notifications",
        message: error.message,
      }),
    };
  }
}

/**
 * Fetch recipients for weekly report from Supabase
 * Gets users who have opted in to receive weekly reports
 * @returns {Promise<Array>} Array of recipient objects with email
 */
async function getWeeklyReportRecipients() {
  const supabase = getSupabaseClient();

  try {
    console.log("Fetching weekly report recipients from Supabase");

    // Query users with receive_weekly_reports = true
    const { data, error } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, preferences")
      .eq("receive_weekly_reports", true);

    if (error) {
      console.error("Error fetching weekly report recipients:", error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} recipients for weekly report`);

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
