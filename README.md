# Kinetic Integrity Monitor — Free-to-Pro Upgrade System

Production-ready Free → Pro upgrade flow for KIM. Users get 5 agents free, hit a soft paywall at agent 6, and upgrade to unlimited via Sellar.

---

## Architecture Overview

```
User tries to add 6th agent
        ↓
POST /api/agents → 402 { error: "agent_limit_reached", upgrade_url }
        ↓
Frontend shows <UpgradeDialog />
        ↓
User clicks "Upgrade to Pro"
        ↓
POST /api/upgrade → { checkout_url }
        ↓
window.location.href = checkout_url (Sellar checkout)
        ↓
User pays $299/month in Sellar
        ↓
Sellar POST /api/webhook/sellar { type: "payment.success" }
        ↓
Backend upgrades user: subscription_tier = 'pro'
        ↓
User can now create unlimited agents ✓
```

---

## File Structure

```
kim-upgrade/
├── database/
│   └── schema.sql              # PostgreSQL tables, indexes, constraints
│
├── backend/
│   ├── .env.example            # Required environment variables
│   ├── package.json
│   ├── src/
│   │   ├── index.ts            # Express app entry point
│   │   ├── db/pool.ts          # PostgreSQL connection pool
│   │   ├── middleware/auth.ts  # JWT auth middleware
│   │   ├── utils/
│   │   │   ├── logger.ts       # Winston logger
│   │   │   └── tiers.ts        # Tier limits & helpers
│   │   └── routes/
│   │       ├── auth.ts         # POST /signup, POST /login
│   │       ├── agents.ts       # GET/POST/DELETE /agents
│   │       ├── subscription.ts # GET /user/subscription, POST /upgrade
│   │       └── webhook.ts      # POST /webhook/sellar
│   └── tests/
│       └── upgrade.test.ts     # Full integration test suite
│
└── frontend/
    └── src/
        ├── types/index.ts           # TypeScript interfaces
        ├── api/index.ts             # API client (fetch wrapper)
        ├── context/AuthContext.tsx  # Auth state provider
        └── components/
            ├── AgentList.tsx         # Main dashboard with all sub-components
            ├── UpgradeDialog.tsx     # Paywall modal
            ├── SubscriptionCard.tsx  # Subscription status card
            ├── AgentQuotaBar.tsx     # Inline quota indicator
            ├── QuotaWarningBanner.tsx # Warning when ≤2 agents remain
            └── UpgradePrompt.tsx     # Context-aware CTA banner
```

---

## Setup

### 1. Database

```bash
# Create database
createdb kim_db

# Run schema
psql kim_db -f database/schema.sql
```

### 2. Backend

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your values

npm run dev      # Development with hot reload
npm run build    # Production build
npm start        # Run production build
```

### Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random 32+ character secret |
| `SELLAR_PRO_PRODUCT_ID` | Your Sellar product ID for Pro tier |
| `SELLAR_WEBHOOK_SECRET` | Sellar webhook signing secret (optional but recommended) |
| `ALLOWED_ORIGIN` | Frontend URL for CORS |

### 3. Frontend

```bash
cd frontend
npm install

# Set API URL
echo "REACT_APP_API_URL=http://localhost:3001" > .env.local

npm start    # Development
npm run build # Production
```

---

## API Reference

### Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register + auto-assign Free tier |
| POST | `/api/auth/login` | No | Login, receive JWT |
| GET | `/api/agents` | Yes | List agents + subscription info |
| POST | `/api/agents` | Yes | Create agent (enforces 5-agent limit for Free) |
| DELETE | `/api/agents/:id` | Yes | Delete an agent |
| GET | `/api/user/subscription` | Yes | Subscription status |
| POST | `/api/upgrade` | Yes | Get Sellar checkout URL |
| POST | `/api/webhook/sellar` | No | Sellar payment webhook |

### 402 Response (agent limit reached)

```json
{
  "error": "agent_limit_reached",
  "message": "Free tier limited to 5 agents. Upgrade to Pro for unlimited agents.",
  "current_count": 5,
  "limit": 5,
  "tier": "free",
  "upgrade_url": "https://checkout.sellar.io/YOUR_PRODUCT_ID?prefill_email=..."
}
```

---

## Sellar Webhook Setup

1. In your Sellar dashboard, set webhook URL to:
   `https://yourdomain.com/api/webhook/sellar`

2. Subscribe to events: `payment.success`, `subscription.created`

3. Copy the webhook signing secret into `SELLAR_WEBHOOK_SECRET`

The webhook handler:
- Verifies signature (HMAC-SHA256)
- Finds user by `customer_email` or `sellar_customer_id`
- Sets `subscription_tier = 'pro'`
- Logs change to `subscription_changes` audit table
- Returns 200 always (prevents Sellar retry storms)

---

## Frontend Components

### `<AgentList />`
Main dashboard. Fetches agents + subscription, handles create/delete, shows `<UpgradeDialog>` on 402 error.

### `<UpgradeDialog isOpen onClose currentCount limit tier upgradeUrl />`
Full-screen modal with tier comparison, ROI calculator, and redirect to Sellar.

### `<SubscriptionCard subscription onUpgradeClick />`
Sidebar card showing quota, progress bar, and upgrade CTA.

### `<AgentQuotaBar subscription />`
Compact inline indicator with color-coded progress (green → yellow → red).

### `<QuotaWarningBanner subscription onUpgradeClick />`
Auto-shown when ≤2 agents remain. Auto-dismisses after 15s.

### `<UpgradePrompt userTier context onUpgrade />`
Context-aware CTA banner for dashboard, agents page, or analytics page.

---

## Testing

```bash
cd backend

# Set test database
export TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/kim_test

npm test         # Run all tests
npm test -- --coverage  # With coverage report
```

Tests cover:
- Signup → free tier assignment
- Login → JWT issuance
- Agent creation (agents 1–5 succeed, 6th returns 402)
- Webhook upgrades user to Pro
- After upgrade, 6th+ agents succeed
- Auth enforcement on all protected routes

---

## Deployment Checklist

- [ ] Set all required environment variables
- [ ] Run `database/schema.sql` on production DB
- [ ] Configure Sellar webhook URL
- [ ] Set `NODE_ENV=production` to hide stack traces
- [ ] Enable SSL on database connection
- [ ] Configure CORS `ALLOWED_ORIGIN` to production frontend URL
- [ ] Set strong `JWT_SECRET` (use `openssl rand -hex 32`)
- [ ] Test webhook with Sellar's test payment
- [ ] Monitor `subscription_changes` table for audit trail

---

## Troubleshooting

**User not upgraded after payment**
- Check `/api/webhook/sellar` logs for the webhook call
- Verify `SELLAR_WEBHOOK_SECRET` matches Sellar dashboard
- Confirm user exists with matching email or `sellar_customer_id`

**402 error even on Pro**
- JWT may be stale (issued before upgrade). User should log out and back in.
- Verify `subscription_tier = 'pro'` in the `users` table

**CORS errors**
- Check `ALLOWED_ORIGIN` env var matches your frontend URL exactly

**Database connection errors**
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`
- Check firewall/network rules if using hosted DB
