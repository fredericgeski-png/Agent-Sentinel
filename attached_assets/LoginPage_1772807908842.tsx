import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from './AuthLayout';
import FormInput, { PasswordToggle } from './FormInput';
import type { FieldErrors } from '../../types/auth';

function validateEmail(email: string): string | undefined {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const from = (location.state as { from?: string })?.from ?? '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    if (!password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const e = err as { message?: string; error?: string };
      if (e.error === 'account_locked') {
        setError(e.message ?? 'Account temporarily locked. Please try again later.');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, password, login, navigate, from]);

  if (isLoading) return null;

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Kinetic account">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Global error */}
        {error && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(255,68,102,0.12)', border: '1px solid rgba(255,68,102,0.4)', color: '#ff4466' }}
          >
            {error}
          </div>
        )}

        <FormInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
          error={fieldErrors.email}
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          disabled={submitting}
          required
        />

        <FormInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
          error={fieldErrors.password}
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={submitting}
          required
          rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
        />

        {/* Forgot password */}
        <div className="flex justify-end -mt-2">
          <Link
            to="/forgot-password"
            style={{ color: '#00d4ff', fontSize: 13 }}
            className="hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-1"
          style={{
            background: submitting ? 'rgba(0,212,255,0.4)' : 'linear-gradient(90deg, #00d4ff, #0099cc)',
            color: '#0a0e27',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'opacity 200ms',
          }}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Signing in…
            </>
          ) : 'Sign in'}
        </button>

        <p className="text-center text-sm" style={{ color: '#64748b' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#00d4ff' }} className="hover:underline font-medium">
            Create account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
