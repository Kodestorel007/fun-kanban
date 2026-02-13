import { useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/themeColors';

/**
 * MobileTaskCard — ZERO dnd-kit. ZERO React synthetic touch handlers.
 * All touch listeners use native addEventListener with { passive: true }
 * so the browser scrolls IMMEDIATELY without waiting for JS.
 */
const LONG_PRESS_MS = 500;
const haptic = { heavy: () => navigator.vibrate?.([30, 20, 30]) };

export default function MobileTaskCard({ task, onClick, project, onLongPress, onPriorityTap }) {
  const { theme } = useTheme();
  const projectColor = project?.color ? getDisplayColor(project.color, theme) : '#22c55e';

  const cardRef = useRef(null);
  const lpTimer = useRef(null);
  const didLP = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  // Keep latest callbacks in refs so passive listeners always see current values
  const onClickRef = useRef(onClick);
  const onLPRef = useRef(onLongPress);
  const onPTRef = useRef(onPriorityTap);
  const taskRef = useRef(task);
  useEffect(() => { onClickRef.current = onClick; }, [onClick]);
  useEffect(() => { onLPRef.current = onLongPress; }, [onLongPress]);
  useEffect(() => { onPTRef.current = onPriorityTap; }, [onPriorityTap]);
  useEffect(() => { taskRef.current = task; }, [task]);

  // Register ALL touch listeners as PASSIVE via native addEventListener
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onStart = (e) => {
      const t = e.touches[0];
      startPos.current = { x: t.clientX, y: t.clientY };
      didLP.current = false;

      lpTimer.current = setTimeout(() => {
        didLP.current = true;
        haptic.heavy();
        if (onLPRef.current) {
          const sw = window.innerWidth, sh = window.innerHeight;
          const mw = 200, mh = 300;
          let mx = t.clientX > sw / 2 ? Math.max(10, t.clientX - mw - 30) : Math.min(sw - mw - 10, t.clientX + 30);
          let my = Math.max(10, Math.min(t.clientY - mh / 3, sh - mh - 10));
          onLPRef.current(taskRef.current, { x: mx, y: my });
        }
      }, LONG_PRESS_MS);
    };

    const onMove = (e) => {
      if (!lpTimer.current) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - startPos.current.x) > 10 || Math.abs(t.clientY - startPos.current.y) > 10) {
        clearTimeout(lpTimer.current);
        lpTimer.current = null;
      }
    };

    const onEnd = () => {
      if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      if (lpTimer.current) clearTimeout(lpTimer.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (didLP.current) { didLP.current = false; return; }
    onClickRef.current?.(taskRef.current);
  }, []);

  const handlePriorityClick = useCallback((e) => {
    e.stopPropagation();
    if (!onPTRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 160;
    let mx = Math.max(10, Math.min(rect.left + rect.width / 2 - menuW / 2, window.innerWidth - menuW - 10));
    let my = rect.bottom + 8;
    if (my + 200 > window.innerHeight) my = rect.top - 200;
    onPTRef.current(taskRef.current, { x: mx, y: my });
  }, []);

  const fmtTime = (d) => {
    if (!d) return 'Just now';
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (dy < 7) return `${dy}d ago`;
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      ref={cardRef}
      className={`task-card ${task.blocked ? 'blocked' : ''} ${task.on_hold ? 'on-hold' : ''}`}
      style={{ borderLeft: project ? `4px solid ${projectColor}` : undefined }}
      tabIndex={-1}
      onClick={handleClick}
    >
      <div className="task-card-header">
        <span className="task-title" style={project ? { color: projectColor } : undefined}>{task.title}</span>
        <div className="task-badges">
          {task.blocked && <span className="task-badge blocked">Blocked</span>}
          {task.on_hold && <span className="task-badge on-hold">On Hold</span>}
        </div>
        <div className="priority-wrapper">
          <button className={`priority-dot ${task.priority || 'low'}`} onClick={handlePriorityClick} tabIndex={-1} aria-label={`Priority: ${task.priority || 'low'}`}>
            <span className="priority-dot-inner" />
          </button>
        </div>
      </div>
      <div className="task-footer">
        {task.due_date ? (
          <span className="task-due">Due: {new Date(task.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        ) : <span className="task-spacer" />}
        <span className="task-last-update">{fmtTime(task.updated_at)}</span>
      </div>
    </div>
  );
}
