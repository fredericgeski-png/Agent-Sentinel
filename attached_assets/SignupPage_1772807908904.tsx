import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from './AuthLayout';
import FormInput, { PasswordToggle } from './FormInput';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import { usePasswordStrength } from '../../hooks/usePasswordStrength';
import type { FieldErrors } from '../../types/auth';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirm]       = useState('');
  const [agreedToTerms, setAgreed]          = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]       = useState<FieldErrors>({});
  const [successMsg, setSuccessMsg]         = useState<string | null>(null);

  const strength = usePasswordStrength(password);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Valid email required';
    if (!strength.checks.length || !strength.checks.uppercase || !strength.checks.lowercase || !strength.checks.number) {
      errs.password = 'Password does not meet requirements';
    }
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signup(email, password, confirmPassword);
      setSuccessMsg('Account created! Redirecting to your dashboard…');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err: unknown) {
      const e = err as { message?: string; error?: string };
      if (e.error === 'email_taken') {
        setFieldErrors((f) => ({ ...f, email: 'An account with this email already exists' }));
      } else {
        setError(e.message ?? 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, password, confirmPassword, agreedToTerms, signup, navigate]);

  if (isLoading) return null;

  return (
    <AuthLayout title="Create your account" subtitle="Start monitoring your AI agents for free">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Global error */}
        {error && (
          <div role="alert" className="px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(255,68,102,0.12)', border: '1px solid rgba(255,68,102,0.4)', color: '#ff4466' }}>
            {error}
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div role="status" className="px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.4)', color: '#00ff88' }}>
            ✓ {successMsg}
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

        <div className="flex flex-col gap-1">
          <FormInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
            error={fieldErrors.password}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            disabled={submitting}
            required
            rightElement={<PasswordToggle show={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
          />
          {password.length > 0 && <PasswordStrengthMeter strength={strength} />}
        </div>

        <FormInput
          label="Confirm password"
          type={showConfirm ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => { setConfirm(e.target.value); setFieldErrors((f) => ({ ...f, confirmPassword: undefined })); }}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          placeholder="Repeat password"
          disabled={submitting}
          required
          rightElement={<PasswordToggle show={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />}
        />

        {/* Terms */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 rounded"
            style={{ accentColor: '#00d4ff' }}
            aria-required="true"
          />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            I agree to the{' '}
            <a href="/terms" target="_blank" style={{ color: '#00d4ff' }} className="hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" style={{ color: '#00d4ff' }} className="hover:underline">
              Privacy Policy
            </a>
          </span>
        </label>

        {/* Free tier notice */}
        <div className="rounded-lg px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
          <span>🎁</span>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            <strong style={{ color: '#00d4ff' }}>Free tier:</strong> 5 AI agents, basic dashboard, email support — no credit card required.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !agreedToTerms}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          style={{
            background: submitting || !agreedToTerms ? 'rgba(0,212,255,0.3)' : 'linear-gradient(90deg, #00d4ff, #0099cc)',
            color: '#0a0e27',
            cursor: submitting || !agreedToTerms ? 'not-allowed' : 'pointer',
          }}
          aria-busy={submitting}
        >
          {submitting ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> Creating account…</>
          ) : 'Create free account'}
        </button>

        <p className="text-center text-sm" style={{ color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#00d4ff' }} className="hover:underline font-medium">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
