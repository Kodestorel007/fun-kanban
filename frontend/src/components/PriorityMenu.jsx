import { useEffect, useRef } from 'react';

const PRIORITIES = [
  { id: 'high', label: 'High', icon: '\u{1F534}' },
  { id: 'medium', label: 'Medium', icon: '\u{1F7E1}' },
  { id: 'low', label: 'Low', icon: '\u{1F7E2}' },
];

export default function PriorityMenu({ task, position, onSelect, onClose }) {
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

    // Delay so the tap that opened this doesn't immediately close it
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
    <div
      ref={menuRef}
      className="priority-menu"
      style={{ position: 'fixed', left: position.x, top: position.y }}
    >
      <div className="priority-menu-title">Set Priority</div>
      {PRIORITIES.map(p => (
        <button
          key={p.id}
          className={`priority-menu-item ${task.priority === p.id ? 'current' : ''}`}
          onClick={() => { onSelect(task.id, p.id); onClose(); }}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
          {task.priority === p.id && <span className="current-badge">Current</span>}
        </button>
      ))}
      <button className="priority-menu-cancel" onClick={onClose}>Cancel</button>
    </div>
  );
}
