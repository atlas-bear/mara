import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ResendClient } from '../_shared/resend.ts'
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts'

// Process up to 10 emails per invocation
const BATCH_SIZE = 10

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

    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const resend = new ResendClient(
      Deno.env.get('RESEND_API_KEY') ?? '',
      Deno.env.get('RESEND_FROM_EMAIL') ?? ''
    )

    const results = []
    let processedCount = 0

    while (processedCount < BATCH_SIZE) {
      // Get next email to process
      const { data: email } = await supabase.rpc('get_next_email_to_process')

      // No more emails to process
      if (!email) {
        break
      }

      try {
        // Check user preferences if recipient_user_id is set
        if (email.recipient_user_id && email.category_id) {
          const shouldSend = await supabase.rpc('should_send_email', {
            p_user_id: email.recipient_user_id,
            p_category_id: email.category_id
          })

          if (!shouldSend) {
            // Update status to cancelled
            await supabase
              .from('email_queue')
              .update({
                status: 'cancelled',
                error: 'User preferences prevent sending',
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id)

            results.push({
              id: email.id,
              status: 'cancelled',
              error: 'User preferences prevent sending'
            })
            continue
          }
        }

        // Send email using Resend
        const result = await resend.send({
          to: email.recipient_email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          tags: [
            { name: 'queue_id', value: email.id },
            { name: 'category', value: email.category_id ?? 'none' },
            { name: 'template', value: email.template_id ?? 'none' }
          ]
        })

        // Update queue status
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)

        // Record in tracking table
        await supabase
          .from('email_tracking')
          .insert({
            message_id: result.id,
            template_id: email.template_id,
            recipient_email: email.recipient_email,
            subject: email.subject,
            sent_at: new Date().toISOString(),
            status: 'sent',
            metadata: {
              queue_id: email.id,
              category_id: email.category_id,
              resend_id: result.id,
              priority: email.priority,
              retry_count: email.retry_count
            }
          })

        results.push({
          id: email.id,
          status: 'sent',
          message_id: result.id
        })

      } catch (error) {
        // Handle failure
        await supabase.rpc('handle_email_failure', {
          p_email_id: email.id,
          p_error: error instanceof Error ? error.message : 'Unknown error'
        })

        results.push({
          id: email.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      processedCount++
    }

    return successResponse({
      processed: processedCount,
      results
    })

  } catch (error) {
    return errorResponse(
      'Failed to process email queue',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
})
