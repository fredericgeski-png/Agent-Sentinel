import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { canCreateAgent, getAgentLimit, SELLAR_CHECKOUT_BASE } from '../utils/tiers';
import logger from '../utils/logger';

const router = Router();

// ── GET /api/agents ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const userResult = await query<{ subscription_tier: 'free' | 'pro' }>(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId],
    );

    if (!userResult.rows[0]) {
      res.status(401).json({ error: 'user_not_found', message: 'User account not found' });
      return;
    }

    const tier = userResult.rows[0].subscription_tier;

    const agentsResult = await query<{
      id: string;
      name: string;
      framework: string;
      status: string;
      entropy_score: string;
      tokens_consumed: number;
      created_at: string;
    }>(
      `SELECT id, name, framework, status, entropy_score, tokens_consumed, created_at
       FROM agents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    const agents = agentsResult.rows;
    const agentCount = agents.length;
    const agentLimit = getAgentLimit(tier);
    const agentsRemaining = tier === 'pro' ? Infinity : Math.max(0, agentLimit - agentCount);
    const percentageUsed = tier === 'pro' ? 0 : parseFloat(((agentCount / agentLimit) * 100).toFixed(1));

    res.json({
      agents,
      subscription: {
        tier,
        agent_count: agentCount,
        agent_limit: tier === 'pro' ? null : agentLimit,
        agents_remaining: tier === 'pro' ? null : agentsRemaining,
        percentage_used: tier === 'pro' ? null : percentageUsed,
      },
    });
  } catch (err) {
    logger.error('GET /agents error', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'server_error', message: 'Failed to retrieve agents' });
  }
});

// ── POST /api/agents ─────────────────────────────────────────────────────────
const createAgentValidation = [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name must be 1–255 characters'),
  body('framework')
    .isIn(['langchain', 'crewai', 'custom'])
    .withMessage('Framework must be langchain, crewai, or custom'),
];

router.post('/', requireAuth, createAgentValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'validation_error', details: errors.array() });
    return;
  }

  const userId = req.user!.userId;
  const { name, framework } = req.body as { name: string; framework: string };

  try {
    const userResult = await query<{ subscription_tier: 'free' | 'pro' }>(
      'SELECT subscription_tier FROM users WHERE id = $1',
      [userId],
    );

    if (!userResult.rows[0]) {
      res.status(401).json({ error: 'user_not_found', message: 'User account not found' });
      return;
    }

    const tier = userResult.rows[0].subscription_tier;

    const countResult = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM agents WHERE user_id = $1 AND status != 'terminated'",
      [userId],
    );

    const currentCount = parseInt(countResult.rows[0].count, 10);

    if (!canCreateAgent(tier, currentCount)) {
      const limit = getAgentLimit(tier);
      res.status(402).json({
        error: 'agent_limit_reached',
        message: `Free tier limited to ${limit} agents. Upgrade to Pro for unlimited agents.`,
        current_count: currentCount,
        limit,
        tier,
        upgrade_url: 'https://fredericgeski.selar.com/727l48e1z1',
      });
      return;
    }

    const createResult = await query<{
      id: string;
      user_id: string;
      name: string;
      framework: string;
      status: string;
      created_at: string;
    }>(
      `INSERT INTO agents (user_id, name, framework, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, user_id, name, framework, status, created_at`,
      [userId, name, framework],
    );

    const agent = createResult.rows[0];
    const agentLimit = getAgentLimit(tier);
    const agentsRemaining = tier === 'pro' ? Infinity : agentLimit - (currentCount + 1);

    logger.info('Agent created', { userId, agentId: agent.id, tier });

    res.status(201).json({
      agent,
      agents_remaining: tier === 'pro' ? null : agentsRemaining,
    });
  } catch (err) {
    logger.error('POST /agents error', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'server_error', message: 'Failed to create agent' });
  }
});

// ── DELETE /api/agents/:agentId ──────────────────────────────────────────────
router.delete(
  '/:agentId',
  requireAuth,
  [param('agentId').isUUID().withMessage('Invalid agent ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'validation_error', details: errors.array() });
      return;
    }

    const userId = req.user!.userId;
    const { agentId } = req.params;

    try {
      const result = await query(
        'DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id',
        [agentId, userId],
      );

      if (!result.rowCount || result.rowCount === 0) {
        res.status(404).json({
          error: 'agent_not_found',
          message: 'Agent not found or you do not have permission',
        });
        return;
      }

      logger.info('Agent deleted', { userId, agentId });
      res.status(204).send();
    } catch (err) {
      logger.error('DELETE /agents/:id error', { userId, agentId, error: (err as Error).message });
      res.status(500).json({ error: 'server_error', message: 'Failed to delete agent' });
    }
  },
);

export default router;
