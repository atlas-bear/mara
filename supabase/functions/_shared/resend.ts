/**
 * Resend email client for MARA
 * This provides a type-safe wrapper around the Resend API
 */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  react?: unknown;  // React component
  html?: string;    // HTML string
  text?: string;    // Plain text
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;  // Base64 encoded content
  }>;
  tags?: Array<{
    name: string;
    value: string;
  }>;
}

export interface SendResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

export class ResendClient {
  private apiKey: string;
  private fromEmail: string;
  private baseUrl = "https://api.resend.com";

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  /**
   * Send an email using Resend
   */
  async send(options: EmailOptions): Promise<SendResponse> {
    const response = await fetch(`${this.baseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        react: options.react,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
        reply_to: options.replyTo,
        attachments: options.attachments,
        tags: options.tags,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Resend API error: ${response.status} ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get email delivery status
   */
  async getEmailStatus(id: string): Promise<{
    id: string;
    object: string;
    to: string[];
    status: "sent" | "delivered" | "failed";
    created_at: string;
  }> {
    const response = await fetch(`${this.baseUrl}/emails/${id}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Resend API error: ${response.status} ${JSON.stringify(error)}`);
    }

    return response.json();
  }
}
