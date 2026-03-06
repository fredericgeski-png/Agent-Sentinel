import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { isTokenBlacklisted } from '../db/redis';
import { query } from '../db/pool';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { dbTier: 'free' | 'pro' | 'enterprise' };
      rawToken?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch (err: unknown) {
    const expired = (err as Error).name === 'TokenExpiredError';
    res.status(401).json({
      error: expired ? 'token_expired' : 'invalid_token',
      message: expired ? 'Token has expired. Please refresh or login again.' : 'Invalid token.',
    });
    return;
  }

  // Check token blacklist (logout)
  const blacklisted = await isTokenBlacklisted(payload.jti);
  if (blacklisted) {
    res.status(401).json({ error: 'token_revoked', message: 'Token has been revoked. Please login again.' });
    return;
  }

  // Fetch fresh user data (tier may have changed since token was issued)
  try {
    const result = await query<{ subscription_tier: string; subscription_status: string; account_locked_until: string | null }>(
      'SELECT subscription_tier, subscription_status, account_locked_until FROM users WHERE id = $1',
      [payload.userId],
    );

    if (!result.rows[0]) {
      res.status(401).json({ error: 'user_not_found', message: 'User account not found' });
      return;
    }

    const { subscription_tier, account_locked_until } = result.rows[0];

    if (account_locked_until && new Date(account_locked_until) > new Date()) {
      res.status(403).json({ error: 'account_locked', message: 'Account is temporarily locked. Please try again later.' });
      return;
    }

    req.user = {
      ...payload,
      dbTier: subscription_tier as 'free' | 'pro' | 'enterprise',
    };
    req.rawToken = token;

    next();
  } catch (err) {
    logger.error('Auth middleware DB error', { error: (err as Error).message });
    res.status(500).json({ error: 'server_error', message: 'Authentication check failed' });
  }
}

/** Optional: require Pro tier */
export function requirePro(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.dbTier !== 'pro') {
    res.status(402).json({
      error: 'pro_required',
      message: 'This feature requires a Pro subscription.',
      upgrade_url: 'https://fredericgeski.selar.com/727l48e1z1',
    });
    return;
  }
  next();
}
