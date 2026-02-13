import { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/themeColors';

/**
 * TaskCard — DESKTOP ONLY. Used inside SortableContext with full dnd-kit.
 * Mobile uses MobileTaskCard.jsx which has zero dnd-kit imports.
 */
export default function TaskCard({ task, onClick, project, onMove, onLongPress, onDelete, onPriorityChange }) {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const projectColor = project?.color ? getDisplayColor(project.color, theme) : '#22c55e';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: project ? `4px solid ${projectColor}` : undefined,
  };

  const handleClick = useCallback(() => onClick?.(task), [task, onClick]);

  const handlePriorityClick = useCallback((e) => {
    e.stopPropagation();
    if (!onPriorityChange) return;
    const cycle = { low: 'medium', medium: 'high', high: 'low' };
    onPriorityChange(task.id, cycle[task.priority || 'low']);
  }, [task, onPriorityChange]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    onDelete?.(task);
  }, [task, onDelete]);

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
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isDragging ? 'dragging' : ''} ${task.blocked ? 'blocked' : ''} ${task.on_hold ? 'on-hold' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {onDelete && (
        <button className={`delete-btn ${isHovered ? 'visible' : ''}`} onClick={handleDeleteClick} title="Delete task"><X size={12} /></button>
      )}
      <div className="task-card-header">
        <span className="task-title" style={project ? { color: projectColor } : undefined}>{task.title}</span>
        <div className="task-badges">
          {task.blocked && <span className="task-badge blocked" title={task.block_reason || 'Blocked'}>{'\u{1F6AB}'} Blocked</span>}
          {task.on_hold && <span className="task-badge on-hold" title={task.hold_reason || 'On Hold'}>{'\u23F8\uFE0F'} On Hold</span>}
        </div>
        <div className="priority-wrapper">
          <button className={`priority-dot ${task.priority || 'low'}`} onClick={handlePriorityClick} tabIndex={0} title={`Priority: ${task.priority || 'low'}`}>
            <span className="priority-dot-inner" />
          </button>
        </div>
      </div>
      {task.description && (
        <p className="task-description">{task.description.length > 220 ? task.description.substring(0, 220) + '...' : task.description}</p>
      )}
      <div className="task-footer">
        {task.due_date ? (
          <span className="task-due">{'\u{1F4C5}'} Due: {new Date(task.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        ) : <span className="task-spacer" />}
        <span className="task-last-update">Last update: {fmtTime(task.updated_at)}</span>
      </div>
    </div>
  );
}
