// Sends the password-reset email via Resend's HTTP API (https://resend.com)
// using plain fetch — no SDK dependency needed. Sign up at resend.com,
// verify a sending domain (or use their shared test domain while getting
// started), create an API key, and set RESEND_API_KEY + EMAIL_FROM in your
// environment variables.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'Parva Group Portal <onboarding@resend.dev>'

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — cannot send the password-reset email. Add it to your environment variables (see server/.env.example).')
    throw new Error('Email sending is not configured yet.')
  }

  const firstName = (name || '').split(' ')[0] || 'there'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject: 'Reset your Parva Group Portal password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1C2B4A;">
          <p>Hi ${firstName},</p>
          <p>We received a request to reset the password for your Parva Group Portal account. Click the button below to choose a new password:</p>
          <p style="margin: 28px 0;">
            <a href="${resetUrl}" style="background:#1C2B4A;color:#FAF8F5;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">
              Reset your password
            </a>
          </p>
          <p style="font-size:13px;color:#7A7065;">This link works for 30 minutes. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
          <p style="font-size:13px;color:#7A7065;">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Resend email send failed:', res.status, body)
    throw new Error('Could not send the reset email right now.')
  }
}
