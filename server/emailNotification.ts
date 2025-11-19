/**
 * Email Notification System
 * Uses Manus built-in notification API to send emails
 */

import { ENV } from './_core/env';

export type EmailOptions = {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
};

/**
 * Send an email notification
 * Uses the Manus built-in notification API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, body, isHtml = false } = options;

  try {
    const response = await fetch(`${ENV.forgeApiUrl}/notification/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        to,
        subject,
        body,
        contentType: isHtml ? 'text/html' : 'text/plain',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Failed to send email:', response.status, errorText);
      return false;
    }

    console.log(`[Email] Successfully sent email to: ${to}`);
    return true;

  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return false;
  }
}

/**
 * Send password reset email with token
 */
export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetToken: string,
  expiresAt: Date
): Promise<boolean> {
  const resetUrl = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/reset-password`;
  
  const subject = 'Password Reset Request - Mottainai Admin Dashboard';
  
  const body = `
Hello ${username},

You have requested to reset your password for the Mottainai Admin Dashboard.

Your password reset token is:

${resetToken}

To reset your password:
1. Go to: ${resetUrl}
2. Enter the token above
3. Set your new password

This token will expire at: ${expiresAt.toLocaleString()}

If you did not request this password reset, please ignore this email and your password will remain unchanged.

For security reasons, please do not share this token with anyone.

Best regards,
Mottainai Admin Team
  `.trim();

  return await sendEmail({
    to: email,
    subject,
    body,
    isHtml: false,
  });
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string,
  username: string,
  temporaryPassword: string
): Promise<boolean> {
  const loginUrl = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/login`;
  
  const subject = 'Welcome to Mottainai Admin Dashboard';
  
  const body = `
Hello ${username},

Welcome to the Mottainai Admin Dashboard! Your account has been created.

Login credentials:
Username: ${username}
Temporary Password: ${temporaryPassword}

Login URL: ${loginUrl}

For security reasons, please change your password after your first login.

If you have any questions, please contact your administrator.

Best regards,
Mottainai Admin Team
  `.trim();

  return await sendEmail({
    to: email,
    subject,
    body,
    isHtml: false,
  });
}
