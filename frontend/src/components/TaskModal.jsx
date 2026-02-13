import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Send, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getDisplayColor } from '../utils/themeColors';
import api from '../api/client';

const STATUSES = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
];

const PRIORITIES = [
  { id: 'high', label: 'High', color: '#ef4444' },
  { id: 'medium', label: 'Medium', color: '#eab308' },
  { id: 'low', label: 'Low', color: '#22c55e' },
];

export default function TaskModal({ task, projects, onClose, onSave, onDelete }) {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    project_id: task?.project_id || '',
    due_date: task?.due_date?.split('T')[0] || '',
    blocked: task?.blocked || false,
    block_reason: task?.block_reason || '',
    on_hold: task?.on_hold || false,
    hold_reason: task?.hold_reason || '',
  });

  const [saving, setSaving] = useState(false);
  const [updates, setUpdates] = useState(task?.updates || []);
  const [newUpdate, setNewUpdate] = useState('');
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const updateListRef = useRef(null);

  const isNew = !task?.id;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        due_date: form.due_date || null,
        project_id: form.project_id || null,
      };
      await onSave(payload);
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpdate = async (e) => {
    e.preventDefault();
    if (!newUpdate.trim() || !task?.id) return;
    setSendingUpdate(true);
    try {
      const created = await api.addTaskUpdate(task.id, newUpdate.trim());
      setUpdates(prev => [created, ...prev]);
      setNewUpdate('');
    } catch (err) {
      console.error('Failed to add update:', err);
    } finally {
      setSendingUpdate(false);
    }
  };

  const handleDeleteUpdate = async (updateId) => {
    if (!task?.id) return;
    try {
      await api.deleteTaskUpdate(task.id, updateId);
      setUpdates(prev => prev.filter(u => u.id !== updateId));
    } catch (err) {
      console.error('Failed to delete update:', err);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="modal-overlay task-modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? 'New Task' : 'Edit Task'}</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Title */}
            <div className="form-group">
              <label className="form-label">Title</label>
              <input type="text" className="form-input" value={form.title} onChange={e => handleChange('title', e.target.value)} placeholder="Task title" required autoFocus />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => handleChange('description', e.target.value)} placeholder="Add details..." rows={4} />
            </div>

            {/* Status + Priority row */}
            <div className="task-modal-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => handleChange('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => handleChange('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Project + Due Date row */}
            <div className="task-modal-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Project</label>
                <select className="form-select" value={form.project_id} onChange={e => handleChange('project_id', e.target.value)}>
                  <option value="">No project</option>
                  {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={form.due_date} onChange={e => handleChange('due_date', e.target.value)} />
              </div>
            </div>

            {/* Blocked toggle */}
            <div className="task-modal-section">
              <label className="form-checkbox">
                <input type="checkbox" checked={form.blocked} onChange={e => handleChange('blocked', e.target.checked)} />
                <span>Blocked</span>
              </label>
              {form.blocked && (
                <input type="text" className="form-input" value={form.block_reason} onChange={e => handleChange('block_reason', e.target.value)} placeholder="Block reason..." style={{ marginTop: '0.5rem' }} />
              )}
            </div>

            {/* On Hold toggle */}
            <div className="task-modal-section">
              <label className="form-checkbox">
                <input type="checkbox" checked={form.on_hold} onChange={e => handleChange('on_hold', e.target.checked)} />
                <span>On Hold</span>
              </label>
              {form.on_hold && (
                <input type="text" className="form-input" value={form.hold_reason} onChange={e => handleChange('hold_reason', e.target.value)} placeholder="Hold reason..." style={{ marginTop: '0.5rem' }} />
              )}
            </div>

            {/* Updates section (only for existing tasks) */}
            {!isNew && (
              <div className="task-modal-section">
                <div className="task-modal-section-title">Updates</div>
                <form className="task-update-form" onSubmit={handleAddUpdate}>
                  <input type="text" className="form-input" value={newUpdate} onChange={e => setNewUpdate(e.target.value)} placeholder="Add an update..." />
                  <button type="submit" className="btn btn-primary btn-icon" disabled={sendingUpdate || !newUpdate.trim()}>
                    {sendingUpdate ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </form>
                <div className="task-updates-list" ref={updateListRef}>
                  {updates.length === 0 ? (
                    <div className="task-update-empty">No updates yet</div>
                  ) : (
                    updates.map(u => (
                      <div key={u.id} className="task-update-item">
                        <div className="task-update-header">
                          <span className="task-update-author">{u.user_name || 'Unknown'}</span>
                          <span className="task-update-time">{formatDate(u.created_at)}</span>
                          <button className="task-update-delete" onClick={() => handleDeleteUpdate(u.id)} title="Delete"><Trash2 size={14} /></button>
                        </div>
                        <div className="task-update-content">{u.content}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {!isNew && onDelete && (
              <button type="button" className="btn btn-danger" onClick={() => onDelete(task)}>Delete Task</button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : (isNew ? 'Create Task' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
