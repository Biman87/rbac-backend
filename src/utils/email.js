// src/utils/email.js
// Nodemailer-based email sender.
//
// Development:  Automatically creates an Ethereal test account and logs the
//               preview URL to the console — no SMTP config needed.
// Production:   Uses SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS from env.

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// ─── Transport factory ────────────────────────────────────────────────────────

let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  if (env.isProduction) {
    _transporter = nodemailer.createTransport({
      host:   env.SMTP_HOST,
      port:   env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    // Auto-create a free Ethereal test account in dev
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`📧  Ethereal test account: ${testAccount.user}`);
  }

  return _transporter;
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Sends an email.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 */
export async function sendEmail({ to, subject, html, text }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from:    env.EMAIL_FROM,
    to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, ''),  // strip tags as plain-text fallback
  });

  // In dev, log the Ethereal preview URL so you can inspect the email
  if (!env.isProduction) {
    console.log(`📧  Email preview: ${nodemailer.getTestMessageUrl(info)}`);
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

/**
 * Sends an email verification email.
 * @param {{ to: string, name: string, verifyUrl: string }} opts
 */
export async function sendVerificationEmail({ to, name, verifyUrl }) {
  await sendEmail({
    to,
    subject: 'Verify your email address',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Verify your email</h2>
        <p>Hi ${name ?? to},</p>
        <p>Thanks for registering. Click the button below to verify your email address.
           This link expires in <strong>24 hours</strong>.</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${verifyUrl}"
             style="background:#4F46E5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
            Verify Email
          </a>
        </p>
        <p>Or copy this link into your browser:<br>
           <a href="${verifyUrl}">${verifyUrl}</a></p>
        <p style="color:#888;font-size:12px">If you did not create an account, ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Sends a password reset email.
 * @param {{ to: string, name: string, resetUrl: string }} opts
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  await sendEmail({
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Reset your password</h2>
        <p>Hi ${name ?? to},</p>
        <p>We received a request to reset your password. Click the button below.
           This link expires in <strong>1 hour</strong>.</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${resetUrl}"
             style="background:#4F46E5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </p>
        <p>Or copy this link into your browser:<br>
           <a href="${resetUrl}">${resetUrl}</a></p>
        <p style="color:#888;font-size:12px">
          If you did not request a password reset, ignore this email.
          Your password will not change.
        </p>
      </div>
    `,
  });
}
