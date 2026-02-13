import { useEffect, useRef } from 'react';

const COLUMNS = [
  { id: 'todo', icon: '\u{1F4CB}', label: 'To Do' },
  { id: 'in_progress', icon: '\u26A1', label: 'In Progress' },
  { id: 'done', icon: '\u2705', label: 'Done' },
  { id: 'archived', icon: '\u{1F4E6}', label: 'Archived' },
];

export default function MoveMenu({ task, position, onMove, onDelete, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const handleOutside = (e) => {
      if (!el.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    // Delay so the long-press that opened this doesn't immediately close it
    const tid = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside, { passive: true });
      document.addEventListener('keydown', handleEscape);
    }, 50);

    return () => {
      clearTimeout(tid);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} className="move-menu" style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 1000 }}>
      <div className="move-menu-title">Move to</div>
      {COLUMNS.map(col => (
        <button
          key={col.id}
          className={`move-menu-item ${task.status === col.id ? 'current' : ''}`}
          onClick={() => { if (task.status !== col.id) onMove(col.id); }}
          disabled={task.status === col.id}
        >
          <span>{col.icon}</span>
          <span>{col.label}</span>
          {task.status === col.id && <span className="current-badge">Current</span>}
        </button>
      ))}
      <div className="move-menu-divider" />
      <button className="move-menu-delete" onClick={onDelete}>
        <span>{'\u{1F5D1}\uFE0F'}</span><span>Delete</span>
      </button>
      <button className="move-menu-cancel" onClick={onClose}>Cancel</button>
    </div>
  );
}
