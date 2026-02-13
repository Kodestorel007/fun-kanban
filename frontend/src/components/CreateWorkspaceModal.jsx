import { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  COLOR_PAIRS, getThemeColors, getDefaultColor, getDisplayColor,
  isStandardColor, normalizeColorForStorage, areColorsEquivalent,
} from '../utils/themeColors';

export default function CreateWorkspaceModal({ onClose, onCreate, initialData, isEdit }) {
  const { theme } = useTheme();
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [color, setColor] = useState(() => initialData?.color ? getDisplayColor(initialData.color, theme) : getDefaultColor(theme));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCustom = !isStandardColor(color);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(''); setLoading(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim(), color: normalizeColorForStorage(color) });
    } catch (err) { setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} workspace`); setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Workspace' : 'Create Workspace'}</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error mb-4">{error}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="ws-name">Workspace Name</label>
              <input id="ws-name" type="text" className="form-input" placeholder="e.g., Marketing Team" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ws-desc">Description (optional)</label>
              <textarea id="ws-desc" className="form-textarea" placeholder="What is this workspace for?" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <p className="form-hint">Colors adapt automatically when switching themes</p>
              <div className="color-picker">
                {themeColors.map((c, i) => (
                  <button key={c} type="button" className={`color-option ${areColorsEquivalent(color, c) ? 'selected' : ''}`} style={{ background: c }} onClick={() => setColor(c)} title={COLOR_PAIRS[i].name} />
                ))}
                <label className={`color-option color-custom ${isCustom ? 'selected' : ''}`} style={{ background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} title="Custom color">
                  <input type="color" value={isCustom ? color : '#22c55e'} onChange={e => setColor(e.target.value)} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> {isEdit ? 'Saving...' : 'Creating...'}</> : (isEdit ? 'Save Changes' : 'Create Workspace')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
