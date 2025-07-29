import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, successResponse, errorResponse, parseRequestBody } from '../_shared/http.ts'

interface EmailRequest {
  to: string | string[];
  subject: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  html?: string;
  text?: string;
  categoryId?: string;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: string;
  rateLimitKey?: string;
  rateLimitWindow?: string;
  rateLimitCount?: number;
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return handleCors()
    }

    // Only allow POST
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', undefined, 405)
    }

    // Parse and validate request body
    const {
      to,
      subject,
      templateId,
      variables,
      html,
      text,
      categoryId,
      priority = 'normal',
      scheduledFor,
      rateLimitKey,
      rateLimitWindow,
      rateLimitCount
    } = await parseRequestBody<EmailRequest>(
      req,
      (body) => {
        if (!body.to || !body.subject) {
          return 'Missing required fields: to and subject'
        }
        if (!body.templateId && !body.html && !body.text) {
          return 'Must provide either templateId or html/text content'
        }
        return true
      }
    )

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get user ID if available
    const authHeader = req.headers.get('Authorization')
    let userId: string | undefined
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        userId = user.id
      }
    }

    // If templateId is provided, fetch template
    let emailHtml = html ?? ''
    let emailText = text ?? ''

    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError || !template) {
        return errorResponse(`Template not found: ${templateId}`, templateError, 404)
      }

      // Replace variables in template
      emailHtml = template.html_template
      emailText = template.text_template

      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{${key}}}`, 'g')
          emailHtml = emailHtml.replace(regex, String(value))
          emailText = emailText.replace(regex, String(value))
        }
      }
    }

    // Create queue entries for each recipient
    const recipients = Array.isArray(to) ? to : [to]
    const queueEntries = recipients.map(recipient => ({
      template_id: templateId,
      recipient_email: recipient,
      recipient_user_id: userId,
      category_id: categoryId,
      subject,
      variables: variables ? JSON.stringify(variables) : null,
      html: emailHtml,
      text: emailText,
      priority,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString(),
      rate_limit_key: rateLimitKey,
      rate_limit_window: rateLimitWindow,
      rate_limit_count: rateLimitCount,
      metadata: {
        source_ip: req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent')
      }
    }))

    // Insert into queue
    const { data: queuedEmails, error: queueError } = await supabase
      .from('email_queue')
      .insert(queueEntries)
      .select()

    if (queueError) {
      return errorResponse('Failed to queue emails', queueError)
    }

    // Trigger queue processing
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-email-queue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    }).catch(error => {
      console.error('Failed to trigger queue processing:', error)
      // Don't fail the request if queue processing trigger fails
    })

    return successResponse({
      queued: queuedEmails.length,
      ids: queuedEmails.map(email => email.id)
    })

  } catch (error) {
    return errorResponse(
      'Failed to queue email',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
})
