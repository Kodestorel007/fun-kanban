import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { FolderKanban, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setTokens, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const resp = await api.register(email, password);
      setTokens(resp.access_token, resp.refresh_token);
      navigate('/');
    } catch (err) { setError(err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><FolderKanban size={28} /></div>
          <h1 className="login-title">Fun Kanban</h1>
          <p className="login-subtitle">Create your account</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
            <input id="confirm-password" type="password" className="form-input" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><Loader2 size={20} className="animate-spin" /> Creating account...</> : 'Create Account'}
          </button>
        </form>
        <div className="login-footer">
          <Link to="/login" className="login-link">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
