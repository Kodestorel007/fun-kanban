import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { FolderKanban, Loader2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.forgotPassword(email); } catch {}
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo" style={{ background: 'var(--accent)' }}><Mail size={32} color="white" /></div>
            <h1 className="login-title">Check Your Email</h1>
          </div>
          <p className="text-center text-muted mb-4">If an account exists for <strong>{email}</strong>, we've sent a password reset link.</p>
          <p className="text-center text-muted mb-4" style={{ fontSize: '0.875rem' }}>The link will expire in 1 hour.</p>
          <Link to="/login" className="btn btn-primary w-full">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><FolderKanban size={32} /></div>
          <h1 className="login-title">Forgot Password</h1>
          <p className="login-subtitle">Enter your email to receive a reset link</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input id="email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : 'Send Reset Link'}
          </button>
        </form>
        <div className="login-footer">
          <Link to="/login" className="login-link"><ArrowLeft size={16} /> Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
