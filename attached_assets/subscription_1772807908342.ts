import { Router, Request, Response } from 'express';
import { query, getClient } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { getAgentLimit, SELLAR_CHECKOUT_BASE } from '../utils/tiers';
import logger from '../utils/logger';

const router = Router();

// ── GET /api/user/subscription ───────────────────────────────────────────────
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const userResult = await query<{
      subscription_tier: 'free' | 'pro';
      subscription_status: string;
      upgraded_at: string | null;
    }>(
      'SELECT subscription_tier, subscription_status, upgraded_at FROM users WHERE id = $1',
      [userId],
    );

    const user = userResult.rows[0];
    if (!user) {
      res.status(401).json({ error: 'user_not_found', message: 'User not found' });
      return;
    }

    const tier = user.subscription_tier;

    const countResult = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM agents WHERE user_id = $1 AND status != 'terminated'",
      [userId],
    );

    const agentCount = parseInt(countResult.rows[0].count, 10);
    const agentLimit = getAgentLimit(tier);
    const agentsRemaining = tier === 'pro' ? null : Math.max(0, agentLimit - agentCount);
    const percentageUsed =
      tier === 'pro'
        ? null
        : ((agentCount / agentLimit) * 100).toFixed(1);

    res.json({
      tier,
      status: user.subscription_status,
      agent_count: agentCount,
      agent_limit: tier === 'pro' ? null : agentLimit,
      agents_remaining: agentsRemaining,
      percentage_used: percentageUsed,
      upgraded_at: user.upgraded_at ?? null,
      can_upgrade: tier === 'free',
    });
  } catch (err) {
    logger.error('GET /subscription error', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'server_error', message: 'Failed to retrieve subscription info' });
  }
});

// ── POST /api/upgrade ────────────────────────────────────────────────────────
router.post('/upgrade', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const email = req.user!.email;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Record upgrade intent in audit log
    await client.query(
      `INSERT INTO subscription_changes (user_id, old_tier, new_tier, changed_by, reason)
       VALUES ($1, 'free', 'pro', 'user', 'Initiated upgrade from free tier')`,
      [userId],
    );

    await client.query('COMMIT');

    const checkoutUrl = `https://fredericgeski.selar.com/727l48e1z1?prefill_email=${encodeURIComponent(email)}`;

    logger.info('Upgrade initiated', { userId, email });

    res.json({
      checkout_url: checkoutUrl,
      message: 'Redirect to checkout to complete upgrade',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('POST /upgrade error', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'server_error', message: 'Failed to initiate upgrade' });
  } finally {
    client.release();
  }
});

export default router;
