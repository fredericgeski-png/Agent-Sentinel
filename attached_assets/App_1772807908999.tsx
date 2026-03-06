import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Public auth pages (eager — needed immediately)
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import PasswordResetPage from './components/auth/PasswordResetPage';

// Protected pages (lazy — only loaded after auth)
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const AgentList    = lazy(() => import('./pages/AgentsPage'));
const Settings     = lazy(() => import('./pages/SettingsPage'));
const UpgradePage  = lazy(() => import('./pages/UpgradePage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e27' }}>
      <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: 'rgba(0,212,255,0.3)', borderTopColor: '#00d4ff' }} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public routes ─────────────────────────────────────────── */}
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/signup"          element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<PasswordResetPage />} />

            {/* ── Protected routes ──────────────────────────────────────── */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/agents" element={
              <ProtectedRoute><AgentList /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><Settings /></ProtectedRoute>
            } />
            <Route path="/upgrade" element={
              <ProtectedRoute><UpgradePage /></ProtectedRoute>
            } />

            {/* ── Defaults ──────────────────────────────────────────────── */}
            <Route path="/"  element={<Navigate to="/dashboard" replace />} />
            <Route path="*"  element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
