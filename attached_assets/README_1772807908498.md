# Kinetic Integrity Monitor — Authentication System

Complete production-ready user authentication for KIM. All routes are protected by JWT. New users auto-assigned Free tier.

---

## Flow

```
Visit any protected route
       ↓
ProtectedRoute checks localStorage for JWT
       ↓
Not found / expired → redirect to /login
       ↓
User logs in → POST /api/auth/login returns JWT
       ↓
Token stored in localStorage
       ↓
All API calls: Authorization: Bearer <token>
       ↓
Token auto-refreshed 1 hour before expiry
       ↓
Logout → POST /api/auth/logout → token blacklisted in Redis
```

---

## File Structure

```
kim-auth/
├── database/
│   └── auth-schema.sql           # users, password_resets, auth_logs tables
│
├── backend/
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts              # Express app + security headers + CORS
│   │   ├── db/
│   │   │   ├── pool.ts           # PostgreSQL connection pool
│   │   │   └── redis.ts          # Token blacklist (Redis)
│   │   ├── middleware/
│   │   │   ├── authenticate.ts   # JWT verify + blacklist check + tier attach
│   │   │   └── rateLimiter.ts    # Login (5/15min), signup (3/hr), forgot-pw (3/hr)
│   │   ├── services/
│   │   │   ├── email.ts          # Nodemailer (reset + change notification)
│   │   │   └── authLog.ts        # Write-safe event logging to auth_logs table
│   │   ├── routes/
│   │   │   └── auth.ts           # All 8 endpoints
│   │   └── utils/
│   │       ├── jwt.ts            # generateToken, verifyToken, expiry helpers
│   │       ├── password.ts       # bcrypt hash/compare + strength validation
│   │       └── logger.ts         # Winston
│   └── tests/
│       └── auth.test.ts          # Full integration test suite
│
└── frontend/
    └── src/
        ├── App.tsx                      # BrowserRouter + AuthProvider + all routes
        ├── types/auth.ts                # TypeScript interfaces
        ├── api/client.ts                # Fetch wrapper with auto-refresh + 401 handling
        ├── context/AuthContext.tsx      # Global auth state + auto-refresh timer
        ├── hooks/usePasswordStrength.ts # Password scoring hook
        └── components/auth/
            ├── AuthLayout.tsx           # Shared branded page wrapper
            ├── FormInput.tsx            # Accessible input + PasswordToggle
            ├── PasswordStrengthMeter.tsx # Animated strength bar + checklist
            ├── ProtectedRoute.tsx       # Auth guard + tier guard
            ├── LoginPage.tsx            # Full login form
            ├── SignupPage.tsx           # Signup with real-time strength
            ├── ForgotPasswordPage.tsx   # Email reset request
            └── PasswordResetPage.tsx    # Token-based password reset
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register + auto-assign Free tier |
| POST | `/api/auth/login` | No | Login, return 7-day JWT |
| POST | `/api/auth/logout` | Yes | Blacklist token in Redis |
| POST | `/api/auth/refresh` | Yes | Issue new token (within 24hr of expiry) |
| GET | `/api/auth/me` | Yes | Current user info |
| POST | `/api/auth/change-password` | Yes | Update password + invalidate session |
| POST | `/api/auth/forgot-password` | No | Send reset email (rate limited) |
| POST | `/api/auth/reset-password` | No | Consume reset token, set new password |

---

## Security Features

**Password hashing** — bcrypt, 10 rounds. Never stored plain text.

**JWT** — HS256, 7-day TTL, minimal payload (userId, email, tier, jti). No sensitive data.

**Token blacklist** — Redis stores revoked JTI hashes for remaining token lifetime. Fail-open if Redis is down.

**Rate limiting**
- Login: 5 attempts / 15 min / IP (skips successful)
- Signup: 3 / hr / IP
- Forgot password: 3 / hr / IP

**Account lockout** — 5 consecutive failed logins locks account for 15 minutes.

**Security obscurity** — Login always returns `invalid_credentials` whether email exists or not.

**CSRF** — SameSite headers + no cookie auth (JWT in Authorization header only).

**CSP** — `helmet` with strict Content-Security-Policy.

---

## Setup

### 1. Database

```bash
psql $DATABASE_URL -f database/auth-schema.sql
```

### 2. Redis

```bash
# Local dev
docker run -p 6379:6379 redis:alpine

# Or use Railway / Upstash for production
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env   # Fill in values
npm run dev
```

### Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32 chars — generate with `openssl rand -hex 32` |
| `REDIS_URL` | Redis connection string |
| `APP_URL` | Frontend URL (used in reset email links) |
| `SMTP_*` | Email settings (leave blank for dev log mode) |

### 4. Frontend

```bash
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:3001" > .env.local
npm start
```

---

## Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Must not contain email address

---

## Route Protection

Wrap any page in `<ProtectedRoute>` to require auth:

```tsx
// Require login
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// Require Pro tier
<ProtectedRoute requiredTier="pro">
  <AdvancedAnalytics />
</ProtectedRoute>
```

Unauthenticated → redirect to `/login` (with `?from` preserved).
Wrong tier → redirect to `/upgrade`.

---

## Auto Token Refresh

`AuthContext` automatically schedules a token refresh 1 hour before expiry. The API client also retries on 401 by calling `/api/auth/refresh` once before redirecting to login.

---

## Testing

```bash
cd backend
export DATABASE_URL=postgresql://user:pass@localhost:5432/kim_test
export REDIS_URL=redis://localhost:6379
npm test
```

Tests cover all 8 endpoints including the full signup → login → change password → logout cycle.

---

## Deployment Checklist

- [ ] `JWT_SECRET` is 32+ random chars (`openssl rand -hex 32`)
- [ ] `DATABASE_URL` points to production DB
- [ ] `REDIS_URL` configured (Railway Redis / Upstash / ElastiCache)
- [ ] `APP_URL` = production frontend URL
- [ ] SMTP credentials set for password reset emails
- [ ] `ALLOWED_ORIGIN` = exact production frontend domain
- [ ] `NODE_ENV=production`
- [ ] Run `database/auth-schema.sql` on production DB
- [ ] Test full signup → login → reset flow end-to-end
- [ ] Verify security headers with https://securityheaders.com

---

## Troubleshooting

**"Token expired" on every request**
User's clock may be far off, or `JWT_SECRET` changed. Have user logout and login again.

**Redis connection refused**
Set `REDIS_URL` or start local Redis. System fails-open if Redis is unavailable (tokens won't be blacklisted, but requests won't be blocked).

**Password reset emails not arriving**
Set `SMTP_*` env vars. In dev mode, emails are logged to console only (no actual delivery).

**Account locked**
5 failed logins in 15 min. Either wait, or in emergency: `UPDATE users SET account_locked_until = NULL WHERE email = '...'`.
