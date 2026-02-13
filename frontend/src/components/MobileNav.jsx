import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

const COLUMNS = [
  { id: 'todo', icon: '\u{1F4CB}', label: 'To Do' },
  { id: 'in_progress', icon: '\u26A1', label: 'Progress' },
  { id: 'done', icon: '\u2705', label: 'Done' },
  { id: 'archived', icon: '\u{1F4E6}', label: 'Archive' },
];

export default function MobileNav({ activeColumn, onColumnChange, taskCounts, onQuickAdd }) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState('medium');
  const inputRef = useRef(null);

  // Focus input AFTER modal renders — NOT via autoFocus (causes keyboard flash on mobile)
  useEffect(() => {
    if (showQuickAdd && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [showQuickAdd]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickAdd({ title: quickTitle.trim(), priority: quickPriority, status: activeColumn });
    setQuickTitle('');
    setQuickPriority('medium');
    setShowQuickAdd(false);
  };

  return (
    <>
      {/* Backdrop */}
      {showQuickAdd && (
        <div className="mobile-quickadd-backdrop" onClick={() => setShowQuickAdd(false)} />
      )}

      {/* Bottom Nav */}
      <nav className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {COLUMNS.map(col => (
            <button
              key={col.id}
              className={`mobile-nav-item ${activeColumn === col.id ? 'active' : ''}`}
              onClick={() => onColumnChange(col.id)}
            >
              <span className="mobile-nav-icon">{col.icon}</span>
              <span className="mobile-nav-label">{col.label}</span>
              <span className={`mobile-nav-badge ${(taskCounts[col.id] || 0) === 0 ? 'zero' : ''}`}>
                {taskCounts[col.id] || 0}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* FAB */}
      <button className={`mobile-fab ${showQuickAdd ? 'rotated' : ''}`} onClick={() => setShowQuickAdd(v => !v)}>
        {showQuickAdd ? <X size={28} strokeWidth={2.5} /> : <Plus size={28} strokeWidth={2.5} />}
      </button>

      {/* Quick Add Panel */}
      <div className={`mobile-quick-add-modal ${showQuickAdd ? 'active' : ''}`}>
        <h3>New Task</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Task title..."
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
          />
          <select value={quickPriority} onChange={e => setQuickPriority(e.target.value)}>
            <option value="high">{'\u{1F534}'} High</option>
            <option value="medium">{'\u{1F7E1}'} Medium</option>
            <option value="low">{'\u{1F7E2}'} Low</option>
          </select>
          <button type="submit" className="mobile-add-btn">Add Task</button>
        </form>
      </div>
    </>
  );
}
