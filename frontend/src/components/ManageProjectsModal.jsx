import { useState, useRef, useEffect, useMemo } from 'react';
import api from '../api/client';
import { X, Trash2, Loader2, Pencil, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  COLOR_PAIRS, getThemeColors, getDisplayColor,
  isStandardColor, normalizeColorForStorage, areColorsEquivalent,
} from '../utils/themeColors';

export default function ManageProjectsModal({ projects, onClose, onUpdate }) {
  const { theme } = useTheme();
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  const [deleting, setDeleting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(null);
  const colorPickerRef = useRef(null);

  // Close color picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setColorPickerOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = async (projectId, projectName) => {
    if (prompt(`Type YES to delete "${projectName}". All tasks will be removed.`) !== 'YES') return;
    setDeleting(projectId); setError('');
    try { await api.deleteProject(projectId); onUpdate(); }
    catch (err) { setError(err.message || 'Failed to delete project'); }
    finally { setDeleting(null); }
  };

  const saveEdit = async (projectId) => {
    if (!editName.trim()) { setError('Project name cannot be empty'); return; }
    setSaving(true); setError('');
    try { await api.updateProject(projectId, { name: editName.trim() }); setEditing(null); onUpdate(); }
    catch (err) { setError(err.message || 'Failed to update project'); }
    finally { setSaving(false); }
  };

  const handleColorChange = async (projectId, newColor, close = true) => {
    if (close) setColorPickerOpen(null);
    try { await api.updateProject(projectId, { color: normalizeColorForStorage(newColor) }); onUpdate(); }
    catch (err) { setError(typeof err === 'string' ? err : (err?.message || 'Failed to update color')); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Manage Projects</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error mb-4">{error}</div>}
          {projects.length === 0 ? (
            <p className="text-muted">No projects yet.</p>
          ) : (
            <div className="manage-projects-list">
              {projects.map(p => {
                const dispColor = getDisplayColor(p.color, theme);
                const isCustom = !isStandardColor(p.color);
                return (
                  <div key={p.id} className="manage-project-item">
                    <div className="manage-project-info">
                      <div className="color-picker-wrapper" ref={colorPickerOpen === p.id ? colorPickerRef : null}>
                        <div className="manage-project-color" style={{ background: dispColor }} title="Click to change color" onClick={() => setColorPickerOpen(colorPickerOpen === p.id ? null : p.id)} />
                        {colorPickerOpen === p.id && (
                          <div className="color-picker-dropdown">
                            <div className="color-picker-grid">
                              {themeColors.map((c, i) => (
                                <button key={c} type="button" className={`color-option-small ${areColorsEquivalent(p.color, c) ? 'selected' : ''}`} style={{ backgroundColor: c }} onClick={() => handleColorChange(p.id, c)} title={COLOR_PAIRS[i].name} />
                              ))}
                              <label className={`color-option-small color-custom-small ${isCustom ? 'selected' : ''}`} style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} title="Custom color">
                                <input type="color" value={dispColor} onChange={e => handleColorChange(p.id, e.target.value, false)} onBlur={() => setColorPickerOpen(null)} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                      {editing === p.id ? (
                        <input type="text" className="manage-project-input" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEdit(p.id) : e.key === 'Escape' && setEditing(null)} onBlur={() => saveEdit(p.id)} autoFocus disabled={saving} />
                      ) : (
                        <span className="manage-project-name" onClick={() => { setEditing(p.id); setEditName(p.name); }} title="Click to edit">{p.name}</span>
                      )}
                    </div>
                    <div className="manage-project-actions">
                      {editing === p.id ? (
                        <button className="btn btn-success btn-sm" onClick={() => saveEdit(p.id)} disabled={saving} title="Save">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}</button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(p.id); setEditName(p.name); }} title="Edit name"><Pencil size={16} /></button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.name)} disabled={deleting === p.id || editing === p.id} title="Delete project">{deleting === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
