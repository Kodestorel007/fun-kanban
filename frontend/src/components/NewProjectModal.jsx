import { useState, useMemo } from 'react';
import api from '../api/client';
import { X, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  COLOR_PAIRS, getThemeColors, getDefaultColor,
  isStandardColor, normalizeColorForStorage, areColorsEquivalent,
} from '../utils/themeColors';

export default function NewProjectModal({ workspaceId, onClose, onCreated }) {
  const { theme } = useTheme();
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(getDefaultColor(theme));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCustom = !isStandardColor(color);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await api.createProject({ name: name.trim(), description: description.trim(), workspace_id: workspaceId, color: normalizeColorForStorage(color) });
      onCreated();
      onClose();
    } catch (err) { setError(err.message || 'Failed to create project'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Project</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error mb-4">{error}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="proj-name">Project Name</label>
              <input id="proj-name" type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign" required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="proj-desc">Description (optional)</label>
              <textarea id="proj-desc" className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this project about?" rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <p className="form-hint">Adapts to theme automatically</p>
              <div className="color-picker">
                {themeColors.map((c, i) => (
                  <button key={c} type="button" className={`color-option ${areColorsEquivalent(color, c) ? 'selected' : ''}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} title={COLOR_PAIRS[i].name} />
                ))}
                <label className={`color-option color-custom ${isCustom ? 'selected' : ''}`} style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} title="Custom color">
                  <input type="color" value={isCustom ? color : '#22c55e'} onChange={e => setColor(e.target.value)} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : null} Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
