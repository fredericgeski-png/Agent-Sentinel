import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import {
  generateToken,
  verifyToken,
  decodeToken,
  secondsUntilExpiry,
  TOKEN_TTL_SECONDS,
} from '../utils/jwt';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { blacklistToken } from '../db/redis';
import { logAuthEvent } from '../services/authLog';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/email';
import { authenticate } from '../middleware/authenticate';
import { loginLimiter, signupLimiter, forgotPasswordLimiter } from '../middleware/rateLimiter';
import logger from '../utils/logger';

const router = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function clientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

// ── POST /api/auth/signup ────────────────────────────────────────────────────
router.post(
  '/signup',
  signupLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword').custom((val, { req }) => {
      if (val !== req.body.password) throw new Error('Passwords do not match');
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'validation_error', message: 'Validation failed', fields: errors.mapped() });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };
    const ip = clientIP(req);

    const pwCheck = validatePasswordStrength(password, email);
    if (!pwCheck.valid) {
      res.status(400).json({ error: 'weak_password', message: pwCheck.errors[0], fields: { password: pwCheck.errors.join(', ') } });
      return;
    }

    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists' });
        return;
      }

      const password_hash = await hashPassword(password);
      const result = await query<{ id: string; email: string; subscription_tier: string; created_at: string }>(
        `INSERT INTO users (email, password_hash, subscription_tier, subscription_status)
         VALUES ($1, $2, 'free', 'active')
         RETURNING id, email, subscription_tier, created_at`,
        [email, password_hash],
      );

      const user = result.rows[0];
      const { token, expiresIn } = generateToken({ userId: user.id, email: user.email, tier: user.subscription_tier as 'free' });

      await logAuthEvent({ userId: user.id, email, eventType: 'signup', success: true, ipAddress: ip, userAgent: req.headers['user-agent'] });

      logger.info('New user signed up', { userId: user.id, email, ip });

      res.status(201).json({
        success: true,
        user: { id: user.id, email: user.email, tier: user.subscription_tier, createdAt: user.created_at },
        token,
        expiresIn,
        message: 'Account created! Welcome to Kinetic. You have 5 free agents.',
      });
    } catch (err) {
      logger.error('Signup error', { error: (err as Error).message });
      res.status(500).json({ error: 'server_error', message: 'Registration failed. Please try again.' });
    }
  },
);

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'validation_error', message: 'Email and password are required' });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };
    const ip = clientIP(req);

    try {
      const result = await query<{
        id: string; email: string; password_hash: string;
        subscription_tier: string; login_attempt_count: number;
        login_attempt_reset_at: string | null; account_locked_until: string | null;
      }>(
        `SELECT id, email, password_hash, subscription_tier,
                login_attempt_count, login_attempt_reset_at, account_locked_until
         FROM users WHERE email = $1`,
        [email],
      );

      const user = result.rows[0];

      // Check account lockout
      if (user?.account_locked_until && new Date(user.account_locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.account_locked_until).getTime() - Date.now()) / 60000);
        await logAuthEvent({ userId: user.id, email, eventType: 'login', success: false, ipAddress: ip, errorMessage: 'Account locked' });
        res.status(403).json({
          error: 'account_locked',
          message: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
        });
        return;
      }

      // Generic error for both "not found" and "wrong password" (don't reveal user existence)
      const GENERIC_ERROR = { error: 'invalid_credentials', message: 'Invalid email or password' };

      if (!user) {
        await logAuthEvent({ email, eventType: 'login', success: false, ipAddress: ip, errorMessage: 'User not found' });
        res.status(401).json(GENERIC_ERROR);
        return;
      }

      const passwordMatch = await comparePassword(password, user.password_hash);

      if (!passwordMatch) {
        // Reset window if needed
        const now = new Date();
        const windowReset = user.login_attempt_reset_at ? new Date(user.login_attempt_reset_at) : null;
        const inWindow = windowReset && windowReset > now;
        const newCount = inWindow ? user.login_attempt_count + 1 : 1;
        const newResetAt = inWindow ? user.login_attempt_reset_at : new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString();
        const lockUntil = newCount >= MAX_FAILED_ATTEMPTS
          ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null;

        await query(
          `UPDATE users SET login_attempt_count = $1, login_attempt_reset_at = $2, account_locked_until = $3 WHERE id = $4`,
          [newCount, newResetAt, lockUntil, user.id],
        );

        await logAuthEvent({ userId: user.id, email, eventType: 'login', success: false, ipAddress: ip, errorMessage: 'Wrong password' });

        if (newCount >= MAX_FAILED_ATTEMPTS) {
          res.status(403).json({ error: 'account_locked', message: `Account locked for ${LOCKOUT_MINUTES} minutes after too many failed attempts.` });
          return;
        }

        res.status(401).json(GENERIC_ERROR);
        return;
      }

      // Success — reset attempt counter, update last_login
      await query(
        'UPDATE users SET login_attempt_count = 0, account_locked_until = NULL, last_login_at = NOW() WHERE id = $1',
        [user.id],
      );

      const { token, expiresIn } = generateToken({ userId: user.id, email: user.email, tier: user.subscription_tier as 'free' });

      await logAuthEvent({ userId: user.id, email, eventType: 'login', success: true, ipAddress: ip, userAgent: req.headers['user-agent'] });

      logger.info('User logged in', { userId: user.id, ip });

      res.json({
        success: true,
        user: { id: user.id, email: user.email, tier: user.subscription_tier },
        token,
        expiresIn,
        message: 'Login successful!',
      });
    } catch (err) {
      logger.error('Login error', { error: (err as Error).message });
      res.status(500).json({ error: 'server_error', message: 'Login failed. Please try again.' });
    }
  },
);

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'invalid_token', message: 'Token is invalid or expired' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const secsLeft = secondsUntilExpiry(payload);

    // Allow refresh only if within 24 hours of expiry
    if (secsLeft > 24 * 60 * 60) {
      res.status(200).json({
        success: true,
        token, // return same token
        expiresIn: secsLeft,
        message: 'Token still valid, no refresh needed',
      });
      return;
    }

    // Blacklist old token (remaining TTL)
    await blacklistToken(payload.jti, Math.max(secsLeft, 1));

    const { token: newToken, expiresIn } = generateToken({ userId: payload.userId, email: payload.email, tier: payload.tier });

    await logAuthEvent({ userId: payload.userId, email: payload.email, eventType: 'refresh_token', success: true });

    res.json({ success: true, token: newToken, expiresIn, message: 'Token refreshed' });
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Token is invalid or expired' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const { userId, email, jti, exp } = req.user!;
  const secsLeft = exp ? exp - Math.floor(Date.now() / 1000) : TOKEN_TTL_SECONDS;

  await blacklistToken(jti, Math.max(secsLeft, 1));
  await logAuthEvent({ userId, email, eventType: 'logout', success: true, ipAddress: clientIP(req) });

  logger.info('User logged out', { userId });
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const { userId } = req.user!;

  try {
    const result = await query<{
      id: string; email: string; subscription_tier: string; subscription_status: string;
      created_at: string; upgraded_at: string | null;
    }>(
      'SELECT id, email, subscription_tier, subscription_status, created_at, upgraded_at FROM users WHERE id = $1',
      [userId],
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        tier: user.subscription_tier,
        status: user.subscription_status,
        createdAt: user.created_at,
        upgradedAt: user.upgraded_at ?? null,
      },
    });
  } catch (err) {
    logger.error('GET /me error', { error: (err as Error).message });
    res.status(500).json({ error: 'server_error', message: 'Failed to fetch user info' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    body('confirmPassword').custom((val, { req }) => {
      if (val !== req.body.newPassword) throw new Error('Passwords do not match');
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'validation_error', fields: errors.mapped() });
      return;
    }

    const { userId, email } = req.user!;
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

    const pwCheck = validatePasswordStrength(newPassword, email);
    if (!pwCheck.valid) {
      res.status(400).json({ error: 'weak_password', message: pwCheck.errors[0] });
      return;
    }

    try {
      const result = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
      const user = result.rows[0];

      if (!user || !(await comparePassword(currentPassword, user.password_hash))) {
        res.status(401).json({ error: 'invalid_password', message: 'Current password is incorrect' });
        return;
      }

      const newHash = await hashPassword(newPassword);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

      // Blacklist current token — force re-login
      const { jti, exp } = req.user!;
      const secsLeft = exp ? exp - Math.floor(Date.now() / 1000) : TOKEN_TTL_SECONDS;
      await blacklistToken(jti, Math.max(secsLeft, 1));

      await logAuthEvent({ userId, email, eventType: 'password_change', success: true, ipAddress: clientIP(req) });
      await sendPasswordChangedEmail(email);

      res.json({ success: true, message: 'Password changed successfully. Please login again.' });
    } catch (err) {
      logger.error('Change password error', { error: (err as Error).message });
      res.status(500).json({ error: 'server_error', message: 'Failed to change password' });
    }
  },
);

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'validation_error', message: 'Valid email required' });
      return;
    }

    const { email } = req.body as { email: string };
    const ip = clientIP(req);

    // Always return 200 — never reveal whether email exists
    const SUCCESS_RESPONSE = { success: true, message: 'If this email exists, a reset link has been sent.' };

    try {
      const result = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        await logAuthEvent({ email, eventType: 'password_reset_request', success: false, ipAddress: ip, errorMessage: 'Email not found' });
        res.json(SUCCESS_RESPONSE);
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing reset tokens for this user
      await query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
      await query(
        'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt],
      );

      await sendPasswordResetEmail(email, token);
      await logAuthEvent({ userId: user.id, email, eventType: 'password_reset_request', success: true, ipAddress: ip });

      res.json(SUCCESS_RESPONSE);
    } catch (err) {
      logger.error('Forgot password error', { error: (err as Error).message });
      res.json(SUCCESS_RESPONSE); // Never leak errors
    }
  },
);

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token required'),
    body('newPassword').isLength({ min: 8 }),
    body('confirmPassword').custom((val, { req }) => {
      if (val !== req.body.newPassword) throw new Error('Passwords do not match');
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'validation_error', fields: errors.mapped() });
      return;
    }

    const { token, newPassword } = req.body as { token: string; newPassword: string };
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const resetResult = await client.query<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
        'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token = $1',
        [token],
      );

      const resetRow = resetResult.rows[0];

      if (!resetRow || resetRow.used_at || new Date(resetRow.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'invalid_token', message: 'Reset token is invalid or expired' });
        return;
      }

      const userResult = await client.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [resetRow.user_id]);
      const user = userResult.rows[0];

      const pwCheck = validatePasswordStrength(newPassword, user?.email);
      if (!pwCheck.valid) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'weak_password', message: pwCheck.errors[0] });
        return;
      }

      const newHash = await hashPassword(newPassword);
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, resetRow.user_id]);
      await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [resetRow.id]);

      await client.query('COMMIT');

      await logAuthEvent({ userId: resetRow.user_id, email: user?.email ?? '', eventType: 'password_reset_complete', success: true });

      res.json({ success: true, message: 'Password reset successful. Please login with your new password.' });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Reset password error', { error: (err as Error).message });
      res.status(500).json({ error: 'server_error', message: 'Password reset failed. Please try again.' });
    } finally {
      client.release();
    }
  },
);

export default router;
