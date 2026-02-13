import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FolderKanban, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await login(email, password); navigate('/'); }
    catch (err) { setError(err.message || 'Invalid email or password'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><FolderKanban size={28} /></div>
          <h1 className="login-title">Fun Kanban</h1>
          <p className="login-subtitle">Sign in to your account</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><Loader2 size={20} className="animate-spin" /> Signing in...</> : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
          <Link to="/forgot-password" className="login-link">Forgot your password?</Link>
          <span className="login-divider">&bull;</span>
          <Link to="/register" className="login-link">Create account</Link>
        </div>
      </div>
    </div>
  );
}
