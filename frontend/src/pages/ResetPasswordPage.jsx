import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { FolderKanban, Loader2, ArrowLeft, Check } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try { await api.resetPassword(token, password); setSuccess(true); setTimeout(() => navigate('/login'), 3000); }
    catch (err) { setError(err.message || 'Failed to reset password'); }
    finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="login-page"><div className="login-card">
        <div className="login-header"><div className="login-logo"><FolderKanban size={32} /></div><h1 className="login-title">Invalid Link</h1></div>
        <p className="text-center text-muted mb-4">This password reset link is invalid or has expired.</p>
        <Link to="/login" className="btn btn-primary w-full">Back to Login</Link>
      </div></div>
    );
  }

  if (success) {
    return (
      <div className="login-page"><div className="login-card">
        <div className="login-header"><div className="login-logo" style={{ background: 'var(--accent)' }}><Check size={32} color="white" /></div><h1 className="login-title">Password Reset!</h1></div>
        <p className="text-center text-muted mb-4">Your password has been reset successfully. Redirecting to login...</p>
        <Link to="/login" className="btn btn-primary w-full">Go to Login</Link>
      </div></div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><FolderKanban size={32} /></div>
          <h1 className="login-title">Reset Password</h1>
          <p className="login-subtitle">Enter your new password</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label className="form-label" htmlFor="password">New Password</label>
            <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" type="password" className="form-input" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><Loader2 size={18} className="animate-spin" /> Resetting...</> : 'Reset Password'}
          </button>
        </form>
        <div className="login-footer">
          <Link to="/login" className="login-link"><ArrowLeft size={16} /> Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
