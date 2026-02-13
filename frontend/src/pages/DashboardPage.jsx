import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getDisplayColor } from '../utils/themeColors';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import CreateWorkspaceModal from '../components/CreateWorkspaceModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { workspaces, reloadWorkspaces, setHeaderActions } = useOutletContext();

  const [showCreate, setShowCreate] = useState(false);
  const [editingWs, setEditingWs] = useState(null);
  const [loading, setLoading] = useState(false);

  // Clear header actions on this page
  useEffect(() => { setHeaderActions?.(null); }, [setHeaderActions]);

  const handleCreate = async (data) => {
    await api.createWorkspace(data);
    reloadWorkspaces();
    setShowCreate(false);
  };

  const handleEdit = async (data) => {
    await api.updateWorkspace(editingWs.id, data);
    reloadWorkspaces();
    setEditingWs(null);
  };

  const handleDelete = async (ws) => {
    const confirmed = prompt(`Type YES to delete workspace "${ws.name}". This cannot be undone.`);
    if (confirmed !== 'YES') return;
    try {
      await api.deleteWorkspace(ws.id);
      reloadWorkspaces();
    } catch (err) {
      alert(err.message || 'Failed to delete workspace');
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Welcome back, {user?.display_name || 'User'}</h2>
          <p className="dashboard-subtitle">Select a workspace to get started</p>
        </div>
        {!user?.is_guest && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={20} /> New Workspace
          </button>
        )}
      </div>

      {workspaces.length === 0 ? (
        <div className="empty-state">
          <h3>No workspaces yet</h3>
          <p className="empty-state-text">Create your first workspace to start organizing tasks</p>
          {!user?.is_guest && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={20} /> Create Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map(ws => {
            const color = getDisplayColor(ws.color, theme);
            return (
              <div key={ws.id} className="workspace-card" onClick={() => navigate(`/workspace/${ws.id}`)}>
                <div className="workspace-card-accent" style={{ background: color }} />
                <div className="workspace-card-body">
                  <h3 className="workspace-card-name" style={{ color }}>{ws.name}</h3>
                  {ws.description && <p className="workspace-card-desc">{ws.description}</p>}
                  <div className="workspace-card-meta">
                    <span>{ws.task_count ?? 0} tasks</span>
                    <span>{ws.member_count ?? 1} members</span>
                  </div>
                </div>
                {!user?.is_guest && (
                  <div className="workspace-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingWs(ws)} title="Edit"><Pencil size={16} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(ws)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
      {editingWs && (
        <CreateWorkspaceModal onClose={() => setEditingWs(null)} onCreate={handleEdit} initialData={editingWs} isEdit />
      )}
    </div>
  );
}
