import { useState, useEffect } from 'react';
import api from '../api/client';
import { X, Loader2, UserMinus, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MembersModal({ workspaceId, onClose }) {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addRole, setAddRole] = useState('viewer');
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadData(); }, [workspaceId]);

  const loadData = async () => {
    try {
      const [m, u] = await Promise.all([
        api.getWorkspaceMembers(workspaceId),
        currentUser?.is_admin ? api.getAdminUsers().catch(() => []) : Promise.resolve([]),
      ]);
      setMembers(m);
      setAllUsers(u);
    } catch { setError('Failed to load members'); }
    finally { setLoading(false); }
  };

  const available = allUsers.filter(u => !members.some(m => m.user_id === u.id));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setAdding(true); setError('');
    try { await api.addWorkspaceMember(workspaceId, selectedUserId, addRole); setSelectedUserId(''); loadData(); }
    catch (err) { setError(err.message || 'Failed to add member'); }
    finally { setAdding(false); }
  };

  const handleRemove = async (memberId) => {
    if (!confirm('Remove this member?')) return;
    try { await api.removeWorkspaceMember(workspaceId, memberId); loadData(); }
    catch (err) { setError(err.message || 'Failed to remove member'); }
  };

  const handleToggleRole = async (memberId, currentRole) => {
    const newRole = currentRole === 'editor' ? 'viewer' : 'editor';
    try { await api.updateMemberRole(workspaceId, memberId, newRole); loadData(); }
    catch (err) { setError(err.message || 'Failed to update role'); }
  };

  const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const roleLabel = (r) => r === 'owner' ? 'Owner' : r === 'editor' ? 'Editor' : 'Viewer';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Workspace Members</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error mb-4">{error}</div>}
          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: '2rem' }}><Loader2 size={24} className="animate-spin" /></div>
          ) : (
            <>
              <div className="members-list">
                {members.map(m => (
                  <div key={m.id} className="member-item">
                    <div className="member-avatar">{initials(m.user_name)}</div>
                    <div className="member-info">
                      <div className="member-name">{m.user_name}</div>
                      <div className="member-email">{m.user_email}</div>
                    </div>
                    <div className="member-role">
                      {m.role === 'owner' ? (
                        <span className="badge badge-warning">{roleLabel(m.role)}</span>
                      ) : (
                        <button className="badge badge-info badge-clickable" onClick={() => handleToggleRole(m.id, m.role)} title="Click to toggle role">{roleLabel(m.role)}</button>
                      )}
                    </div>
                    {m.role !== 'owner' && (
                      <button className="btn btn-ghost btn-icon" onClick={() => handleRemove(m.id)} title="Remove member"><UserMinus size={18} /></button>
                    )}
                  </div>
                ))}
              </div>

              {currentUser?.is_admin && available.length > 0 && (
                <div className="task-modal-section">
                  <div className="task-modal-section-title">Add Member</div>
                  <form className="add-member-form" onSubmit={handleAdd}>
                    <select className="form-select" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} required style={{ flex: 1 }}>
                      <option value="">Select user...</option>
                      {available.map(u => <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>)}
                    </select>
                    <select className="form-select" value={addRole} onChange={e => setAddRole(e.target.value)} style={{ width: 'auto' }}>
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button type="submit" className="btn btn-primary" disabled={adding || !selectedUserId}>
                      {adding ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    </button>
                  </form>
                </div>
              )}

              {!currentUser?.is_admin && (
                <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
                  Only admins can add new members. Create users in the Admin Panel first.
                </p>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
