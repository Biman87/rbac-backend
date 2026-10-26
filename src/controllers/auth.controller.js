// src/controllers/auth.controller.js
// Authentication: register, login, logout, refresh, me,
//                 forgot-password, reset-password,
//                 verify-email, resend-verification.

import bcrypt           from 'bcryptjs';
import crypto           from 'crypto';
import prisma           from '../config/prisma.js';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../utils/jwt.js';
import { attachAuthCookie, clearAuthCookie, attachRefreshCookie, clearRefreshCookie } from '../utils/cookie.js';
import { catchAsync }   from '../utils/catchAsync.js';
import { AppError }     from '../utils/AppError.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { env }          from '../config/env.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESET_TOKEN_EXPIRES_MS        = 60 * 60 * 1000;          // 1 hour
const VERIFY_TOKEN_EXPIRES_MS       = 24 * 60 * 60 * 1000;     // 24 hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Selects user fields safe to return in responses (no password, no tokens). */
const SAFE_USER_SELECT = {
  id:               true,
  email:            true,
  isEmailVerified:  true,
  isActive:         true,
  roleId:           true,
  role:             { select: { id: true, name: true, description: true } },
  createdAt:        true,
  updatedAt:        true,
};

/**
 * Issues access + refresh tokens, sets both cookies, returns the user payload.
 * Creates a new RefreshToken row in the DB (rotated on each call).
 */
async function sendAuthResponse(user, statusCode, res) {
  // 1. Access token (short-lived JWT in cookie)
  const accessToken = signAccessToken({ id: user.id, role: user.role.name });
  attachAuthCookie(res, accessToken);

  // 2. Refresh token (opaque random bytes, hashed in DB, raw in cookie)
  const { raw, hashed, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { token: hashed, userId: user.id, expiresAt },
  });
  attachRefreshCookie(res, raw, expiresAt);

  const { password: _pw, emailVerificationToken: _evt,
          passwordResetToken: _prt, ...safeUser } = user;

  res.status(statusCode).json({
    status: 'success',
    data:   { user: safeUser },
  });
}

/**
 * Generates a raw hex token and its SHA-256 hash for use as
 * email-verification or password-reset tokens.
 */
function generateOpaqueToken() {
  const raw    = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export const register = catchAsync(async (req, res, next) => {
  const { email, password, roleName } = req.body;

  const roleLookup = roleName ?? 'CUSTOMER';
  const role = await prisma.role.findUnique({ where: { name: roleLookup } });
  if (!role) return next(new AppError(`Role "${roleLookup}" does not exist.`, 400));

  const hashedPassword  = await bcrypt.hash(password, 12);
  const { raw, hashed } = generateOpaqueToken();
  const expires         = new Date(Date.now() + VERIFY_TOKEN_EXPIRES_MS);

  const user = await prisma.user.create({
    data: {
      email,
      password:                 hashedPassword,
      roleId:                   role.id,
      isEmailVerified:          false,
      emailVerificationToken:   hashed,
      emailVerificationExpires: expires,
    },
    include: { role: true },
  });

  // Send verification email (fire-and-forget — don't fail registration if email fails)
  const verifyUrl = `${env.CLIENT_URL}/verify-email/${raw}`;
  sendVerificationEmail({ to: user.email, verifyUrl }).catch((err) =>
    console.error('Failed to send verification email:', err.message)
  );

  await sendAuthResponse(user, 201, res);
});

// ─── Login ────────────────────────────────────────────────────────────────────

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where:   { email },
    include: { role: true },
  });

  const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !passwordMatch) {
    return next(new AppError('Invalid email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  if (!user.isEmailVerified) {
    return next(new AppError(
      'Please verify your email address before logging in. Check your inbox or request a new verification email.',
      403
    ));
  }

  await sendAuthResponse(user, 200, res);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = catchAsync(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;

  // Revoke the current refresh token from DB if present
  if (rawToken) {
    const hashed = hashRefreshToken(rawToken);
    await prisma.refreshToken.deleteMany({ where: { token: hashed } });
  }

  clearAuthCookie(res);
  clearRefreshCookie(res);

  res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
});

// ─── Refresh ──────────────────────────────────────────────────────────────────

export const refresh = catchAsync(async (req, res, next) => {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) {
    return next(new AppError('No refresh token provided. Please log in again.', 401));
  }

  const hashed = hashRefreshToken(rawToken);

  // Look up the refresh token record
  const storedToken = await prisma.refreshToken.findUnique({
    where:   { token: hashed },
    include: { user: { include: { role: true } } },
  });

  if (!storedToken) {
    return next(new AppError('Invalid or revoked refresh token. Please log in again.', 401));
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: hashed } });
    clearRefreshCookie(res);
    return next(new AppError('Refresh token has expired. Please log in again.', 401));
  }

  const { user } = storedToken;

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  // Rotate: delete old token, issue new pair
  await prisma.refreshToken.delete({ where: { token: hashed } });

  await sendAuthResponse(user, 200, res);
});

// ─── Me ───────────────────────────────────────────────────────────────────────

export const getMe = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: SAFE_USER_SELECT,
  });

  res.status(200).json({ status: 'success', data: { user } });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return 200 — never reveal whether an account exists (prevents enumeration)
  if (!user) {
    return res.status(200).json({
      status:  'success',
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  }

  const { raw, hashed } = generateOpaqueToken();
  const expires         = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);

  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordResetToken: hashed, passwordResetExpires: expires },
  });

  const resetUrl = `${env.CLIENT_URL}/reset-password/${raw}`;
  sendPasswordResetEmail({ to: user.email, resetUrl }).catch((err) =>
    console.error('Failed to send password reset email:', err.message)
  );

  res.status(200).json({
    status:  'success',
    message: 'If an account with that email exists, a reset link has been sent.',
  });
});

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPassword = catchAsync(async (req, res, next) => {
  const { token }    = req.params;
  const { password } = req.body;

  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:   hashed,
      passwordResetExpires: { gt: new Date() },
    },
    include: { role: true },
  });

  if (!user) {
    return next(new AppError('Reset token is invalid or has expired.', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      password:            hashedPassword,
      passwordResetToken:  null,
      passwordResetExpires: null,
    },
  });

  // Revoke all existing refresh tokens — force re-login on all devices
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  res.status(200).json({
    status:  'success',
    message: 'Password has been reset successfully. Please log in with your new password.',
  });
});

// ─── Verify Email ─────────────────────────────────────────────────────────────

export const verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken:   hashed,
      emailVerificationExpires: { gt: new Date() },
    },
    include: { role: true },
  });

  if (!user) {
    return next(new AppError('Verification link is invalid or has expired.', 400));
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      isEmailVerified:          true,
      emailVerificationToken:   null,
      emailVerificationExpires: null,
    },
  });

  // Re-fetch with role relation so sendAuthResponse has current state
  const verifiedUser = await prisma.user.findUnique({
    where:   { id: user.id },
    include: { role: true },
  });

  await sendAuthResponse(verifiedUser, 200, res);
});

// ─── Resend Verification Email ────────────────────────────────────────────────

export const resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always 200 — prevent email enumeration
  if (!user || user.isEmailVerified) {
    return res.status(200).json({
      status:  'success',
      message: 'If that email is registered and unverified, a new link has been sent.',
    });
  }

  const { raw, hashed } = generateOpaqueToken();
  const expires         = new Date(Date.now() + VERIFY_TOKEN_EXPIRES_MS);

  await prisma.user.update({
    where: { id: user.id },
    data:  { emailVerificationToken: hashed, emailVerificationExpires: expires },
  });

  const verifyUrl = `${env.CLIENT_URL}/verify-email/${raw}`;
  sendVerificationEmail({ to: user.email, verifyUrl }).catch((err) =>
    console.error('Failed to send verification email:', err.message)
  );

  res.status(200).json({
    status:  'success',
    message: 'If that email is registered and unverified, a new link has been sent.',
  });
});
