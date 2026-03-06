import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, getClient } from '../db/pool';
import logger from '../utils/logger';

const router = Router();

function verifySellarSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.SELLAR_WEBHOOK_SECRET;
  if (!secret || !signature) return !secret; // skip verification if no secret configured
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ── POST /api/webhook/sellar ─────────────────────────────────────────────────
router.post(
  '/sellar',
  // Raw body for signature verification (mount before json())
  (req: Request, res: Response, next) => {
    // Body is already parsed by express.json() unless raw body strategy used
    next();
  },
  async (req: Request, res: Response) => {
    const signature = req.headers['x-sellar-signature'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!verifySellarSignature(rawBody, signature)) {
      logger.warn('Sellar webhook: invalid signature');
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }

    const event = req.body as {
      type: string;
      data: {
        customer_id?: string;
        customer_email?: string;
        subscription_id?: string;
        amount?: number;
        currency?: string;
      };
    };

    logger.info('Sellar webhook received', { type: event.type });

    const acceptedTypes = ['payment.success', 'subscription.created'];
    if (!acceptedTypes.includes(event.type)) {
      // Acknowledge but take no action
      res.json({ success: true, message: `Event type '${event.type}' ignored` });
      return;
    }

    const { customer_email, customer_id, subscription_id } = event.data;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Look up user by email or sellar_customer_id
      const userResult = await client.query<{
        id: string;
        email: string;
        subscription_tier: string;
      }>(
        `SELECT id, email, subscription_tier FROM users
         WHERE email = $1 OR sellar_customer_id = $2
         LIMIT 1`,
        [customer_email ?? null, customer_id ?? null],
      );

      if (!userResult.rows[0]) {
        await client.query('ROLLBACK');
        logger.warn('Sellar webhook: user not found', { customer_email, customer_id });
        // Return 200 to acknowledge receipt — don't let Sellar retry forever
        res.json({ success: true, message: 'User not found; event acknowledged' });
        return;
      }

      const user = userResult.rows[0];

      // Upgrade the user
      await client.query(
        `UPDATE users
         SET subscription_tier      = 'pro',
             subscription_status    = 'active',
             sellar_customer_id     = COALESCE($1, sellar_customer_id),
             sellar_subscription_id = COALESCE($2, sellar_subscription_id),
             upgraded_at            = NOW()
         WHERE id = $3`,
        [customer_id ?? null, subscription_id ?? null, user.id],
      );

      // Audit log — only if not already pro
      if (user.subscription_tier !== 'pro') {
        await client.query(
          `INSERT INTO subscription_changes (user_id, old_tier, new_tier, changed_by, reason)
           VALUES ($1, $2, 'pro', 'system', 'Payment successful via Sellar webhook')`,
          [user.id, user.subscription_tier],
        );
      }

      await client.query('COMMIT');

      logger.info('User upgraded to Pro', {
        userId: user.id,
        email: user.email,
        sellarCustomerId: customer_id,
        sellarSubscriptionId: subscription_id,
      });

      res.json({ success: true, message: 'User upgraded to Pro tier' });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Webhook processing error', { error: (err as Error).message, event });
      // Return 200 to prevent Sellar from retrying — log for manual review
      res.json({ success: false, message: 'Internal error; event received' });
    } finally {
      client.release();
    }
  },
);

export default router;
