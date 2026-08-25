import { Resend } from 'resend'
import { createAdminClient } from './supabase/admin'

const resendApiKey = process.env.RESEND_API_KEY

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  if (!resendApiKey) {
    console.warn('[Email Warning] RESEND_API_KEY is not defined. Email was not sent.')
    console.log(`[Email Details] Subject: ${subject}\nTo: ${JSON.stringify(to)}\nContent:\n${html}`)
    return
  }

  const resend = new Resend(resendApiKey)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Modeshare Notifications <onboarding@resend.dev>'
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[Email Error] Resend failed:', error)
    } else {
      console.log('[Email Success] Sent email:', data?.id)
    }
  } catch (err) {
    console.error('[Email Exception] Error sending email:', err)
  }
}

export async function notifySuperAdmins({
  subject,
  html,
}: {
  subject: string
  html: string
}) {
  try {
    const adminClient = createAdminClient()
    const { data: profiles, error } = await adminClient
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')

    if (error) {
      console.error('[Email Error] Failed to fetch super admins:', error)
      return
    }

    const emails = profiles?.map((p) => p.email).filter(Boolean) as string[]

    if (!emails || emails.length === 0) {
      console.warn('[Email Warning] No super admin accounts found to notify.')
      return
    }

    await sendEmail({
      to: emails,
      subject,
      html,
    })
  } catch (err) {
    console.error('[Email Exception] notifySuperAdmins error:', err)
  }
}
