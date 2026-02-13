import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/themeColors';
import { Users, FolderKanban, CheckSquare, Activity, Plus, Loader2, X, Key, UserX, UserCheck, Trash2, Pencil } from 'lucide-react';

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetPwUser, setResetPwUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, u, w, a] = await Promise.all([
        api.getAdminStats().catch(() => ({})),
        api.getAdminUsers().catch(() => []),
        api.getAdminWorkspaces().catch(() => []),
        api.getActivityLog(50).catch(() => []),
      ]);
      setStats(s); setUsers(u); setWorkspaces(w); setActivity(a);
    } catch (e) { console.error('Admin load failed:', e); }
    finally { setLoading(false); }
  };

  const toggleUserStatus = async (u) => {
    try { await api.updateUser(u.id, { is_active: !u.is_active }); loadData(); }
    catch (e) { alert(e.message || 'Failed'); }
  };

  const deleteUser = async (u) => {
    if (prompt(`Type YES to permanently delete "${u.display_name}" (${u.email}).`) !== 'YES') return;
    try { await api.deleteUser(u.id); loadData(); }
    catch (e) { alert(e.message || 'Failed'); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) return <div className="flex items-center justify-center" style={{ height: '50vh' }}><Loader2 size={32} className="animate-spin" /></div>;

  return (
    <div className="admin-page">
      <div className="admin-stats">
        <div className="stat-card"><div className="stat-label">Total Users</div><div className="stat-value">{stats?.users || users.length}</div></div>
        <div className="stat-card"><div className="stat-label">Workspaces</div><div className="stat-value">{stats?.workspaces || workspaces.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Tasks</div><div className="stat-value">{stats?.tasks || 0}</div></div>
        <div className="stat-card"><div className="stat-label">Active (7d)</div><div className="stat-value">{stats?.active_users_7d || '-'}</div></div>
      </div>

      <div className="tabs">
        {['overview', 'users', 'workspaces', 'activity', 'settings'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="admin-section">
          <div className="admin-section-header"><h3 className="admin-section-title">Recent Activity</h3></div>
          <div className="admin-section-body">
            <div className="activity-log">
              {activity.length === 0 ? <div className="empty-state"><Activity size={32} /><p className="empty-state-text">No activity yet</p></div> : (
                activity.slice(0, 10).map((item, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-icon"><Activity size={16} /></div>
                    <div className="activity-content">
                      <div className="activity-text"><strong>{item.user_name}</strong> {item.action}</div>
                      <div className="activity-time">{fmtDate(item.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h3 className="admin-section-title">User Management</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateUser(true)}><Plus size={16} /> Invite User</button>
          </div>
          <div className="admin-section-body">
            <div className="table-wrapper"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead><tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.display_name}</td><td>{u.email}</td>
                  <td><span className={`badge ${u.is_admin ? 'badge-warning' : u.is_guest ? 'badge-secondary' : 'badge-info'}`}>{u.is_admin ? 'Admin' : u.is_guest ? 'Guest' : 'User'}</span></td>
                  <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td>{fmtDate(u.last_login)}</td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(u)} title="Edit"><Pencil size={16} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setResetPwUser(u)} title="Reset Password"><Key size={16} /></button>
                    {u.id !== currentUser?.id && <button className="btn btn-ghost btn-sm" onClick={() => toggleUserStatus(u)} title={u.is_active ? 'Disable' : 'Enable'}>{u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}</button>}
                    {u.id !== currentUser?.id && <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(u)} title="Delete" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {activeTab === 'workspaces' && (
        <div className="admin-section">
          <div className="admin-section-header"><h3 className="admin-section-title">All Workspaces</h3></div>
          <div className="admin-section-body">
            <div className="table-wrapper"><table className="table"><thead><tr><th>Name</th><th>Owner</th><th>Members</th><th>Tasks</th><th>Created</th></tr></thead><tbody>
              {workspaces.map(ws => (
                <tr key={ws.id}>
                  <td><div className="flex items-center gap-2"><span style={{ width: 10, height: 10, borderRadius: 3, background: getDisplayColor(ws.color, theme) }} />{ws.name}</div></td>
                  <td>{ws.owner_name || '-'}</td><td>{ws.member_count || 1}</td><td>{ws.task_count || 0}</td><td>{fmtDate(ws.created_at)}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="admin-section">
          <div className="admin-section-header"><h3 className="admin-section-title">Activity Log</h3></div>
          <div className="admin-section-body">
            <div className="activity-log">
              {activity.length === 0 ? <div className="empty-state"><Activity size={32} /><p className="empty-state-text">No activity</p></div> : (
                activity.map((item, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-icon"><Activity size={16} /></div>
                    <div className="activity-content">
                      <div className="activity-text"><strong>{item.user_name}</strong> {item.action}{item.target && <span> on <strong>{item.target}</strong></span>}</div>
                      <div className="activity-time">{fmtDate(item.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && <SettingsTab />}

      {showCreateUser && <CreateUserModal onClose={() => setShowCreateUser(false)} onCreated={loadData} />}
      {resetPwUser && <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onUpdated={() => { loadData(); setEditingUser(null); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ display_name: '', email: '', is_admin: false, is_guest: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await api.createUser(form); setSuccess(true); setTimeout(() => { onCreated(); onClose(); }, 2000); }
    catch (err) { setError(err.message || 'Failed to invite user'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header"><h2 className="modal-title">Invite User</h2><button className="modal-close" onClick={onClose}><X size={24} /></button></div>
      <form onSubmit={handleSubmit}><div className="modal-body">
        {error && <div className="login-error mb-4">{error}</div>}
        {success && <div className="mb-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--accent)', borderRadius: 6, padding: '0.75rem', color: 'var(--accent)' }}>Invitation sent!</div>}
        <div className="form-group"><label className="form-label">Name</label><input type="text" className="form-input" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} required disabled={success} /></div>
        <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required disabled={success} /></div>
        <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={form.is_guest} onChange={e => setForm(p => ({ ...p, is_guest: e.target.checked, is_admin: false }))} /><span>Guest</span></label></div>
        <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={form.is_admin} onChange={e => setForm(p => ({ ...p, is_admin: e.target.checked, is_guest: false }))} disabled={form.is_guest} /><span>Administrator</span></label></div>
      </div><div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading || success}>{loading ? <Loader2 size={18} className="animate-spin" /> : null} {success ? 'Sent!' : 'Send Invitation'}</button>
      </div></form>
    </div></div>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await api.resetUserPassword(user.id, password); setSuccess(true); setTimeout(onClose, 1500); }
    catch (err) { setError(err.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header"><h2 className="modal-title">Reset Password</h2><button className="modal-close" onClick={onClose}><X size={24} /></button></div>
      <form onSubmit={handleSubmit}><div className="modal-body">
        {error && <div className="login-error mb-4">{error}</div>}
        {success && <div className="mb-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--accent)', borderRadius: 6, padding: '0.75rem', color: 'var(--accent)' }}>Password reset!</div>}
        <p className="text-muted mb-4">Set a new password for <strong>{user.display_name}</strong> ({user.email})</p>
        <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoFocus /></div>
      </div><div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading || success}>{loading ? <Loader2 size={18} className="animate-spin" /> : null} Reset Password</button>
      </div></form>
    </div></div>
  );
}

function EditUserModal({ user, onClose, onUpdated }) {
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await api.updateUser(user.id, { display_name: displayName }); onUpdated(); }
    catch (err) { setError(err.message || 'Failed'); setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header"><h2 className="modal-title">Edit User</h2><button className="modal-close" onClick={onClose}><X size={24} /></button></div>
      <form onSubmit={handleSubmit}><div className="modal-body">
        {error && <div className="login-error mb-4">{error}</div>}
        <div className="form-group"><label className="form-label">Display Name</label><input type="text" className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} required autoFocus /></div>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Email: {user.email}</p>
      </div><div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <Loader2 size={18} className="animate-spin" /> : null} Save</button>
      </div></form>
    </div></div>
  );
}

function SettingsTab() {
  const [smtp, setSmtp] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', smtp_from_email: '', smtp_from_name: 'Fun Kanban', smtp_use_tls: true });
  const [appSettings, setAppSettings] = useState({ app_base_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try { const [s, a] = await Promise.all([api.getSMTPSettings(), api.getAppSettings()]); setSmtp(s); setAppSettings(a); }
    catch (e) { console.error('Settings load failed:', e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setMsg({ type: '', text: '' });
    try { await Promise.all([api.updateSMTPSettings(smtp), api.updateAppSettings(appSettings)]); setMsg({ type: 'success', text: 'Settings saved!' }); }
    catch (err) { setMsg({ type: 'error', text: err.message || 'Failed' }); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setMsg({ type: '', text: '' });
    try { const r = await api.testSMTP(); setMsg({ type: 'success', text: r.message }); }
    catch (err) { setMsg({ type: 'error', text: err.message || 'SMTP test failed' }); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="admin-section"><div className="flex items-center justify-center" style={{ padding: '2rem' }}><Loader2 size={24} className="animate-spin" /></div></div>;

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h3 className="admin-section-title">Settings</h3></div>
      <div className="admin-section-body">
        {msg.text && <div className={`mb-4 ${msg.type === 'success' ? '' : 'login-error'}`} style={msg.type === 'success' ? { background: 'rgba(34,197,94,0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 6, padding: '0.75rem' } : {}}>{msg.text}</div>}
        <form onSubmit={handleSave}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--accent)' }}>Application Settings</h4>
          <div className="form-group"><label className="form-label">Application Base URL</label><input type="text" className="form-input" placeholder="https://yourdomain.com" value={appSettings.app_base_url} onChange={e => setAppSettings(s => ({ ...s, app_base_url: e.target.value }))} /></div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: '2rem 0 1rem', color: 'var(--accent)' }}>Email Settings (SMTP)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group"><label className="form-label">SMTP Host</label><input type="text" className="form-input" placeholder="smtp.gmail.com" value={smtp.smtp_host} onChange={e => setSmtp(s => ({ ...s, smtp_host: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">SMTP Port</label><input type="number" className="form-input" value={smtp.smtp_port} onChange={e => setSmtp(s => ({ ...s, smtp_port: parseInt(e.target.value) || 587 }))} /></div>
            <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" value={smtp.smtp_user} onChange={e => setSmtp(s => ({ ...s, smtp_user: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" placeholder="App password" value={smtp.smtp_password} onChange={e => setSmtp(s => ({ ...s, smtp_password: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">From Name</label><input type="text" className="form-input" value={smtp.smtp_from_name} onChange={e => setSmtp(s => ({ ...s, smtp_from_name: e.target.value }))} /></div>
          </div>
          <div className="form-group" style={{ marginTop: '1rem' }}><label className="form-checkbox"><input type="checkbox" checked={smtp.smtp_use_tls} onChange={e => setSmtp(s => ({ ...s, smtp_use_tls: e.target.checked }))} /><span>Use TLS</span></label></div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 size={18} className="animate-spin" /> : null} Save Settings</button>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing || !smtp.smtp_host}>{testing ? <Loader2 size={18} className="animate-spin" /> : null} Send Test Email</button>
          </div>
        </form>
      </div>
    </div>
  );
}
