import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getDisplayColor } from '../utils/themeColors';
import {
  DndContext, pointerWithin, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Loader2, FolderOpen, ArrowUpDown, Lock, Unlock, Users, Settings } from 'lucide-react';
import TaskCard from '../components/TaskCard';
import MobileTaskCard from '../components/MobileTaskCard';
import MobileNav from '../components/MobileNav';
import MoveMenu from '../components/MoveMenu';
import PriorityMenu from '../components/PriorityMenu';
import TaskModal from '../components/TaskModal';
import NewProjectModal from '../components/NewProjectModal';
import ManageProjectsModal from '../components/ManageProjectsModal';
import MembersModal from '../components/MembersModal';

const COLUMNS = [
  { id: 'todo', title: 'To Do', icon: '\u{1F4CB}' },
  { id: 'in_progress', title: 'In Progress', icon: '\u26A1' },
  { id: 'done', title: 'Done', icon: '\u2705' },
  { id: 'archived', title: 'Archived', icon: '\u{1F4E6}' },
];

// ─── Droppable wrapper for cross-column DnD ────────────
function DroppableColumn({ id, children, className }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'drop-target' : ''}`}>
      {children}
    </div>
  );
}

export default function WorkspacePage() {
  const { workspaceId } = useParams();
  const { reloadWorkspaces, setHeaderActions } = useOutletContext();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeColumn, setActiveColumn] = useState('todo');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState('todo');
  const [filterProject, setFilterProject] = useState('all');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showManageProjects, setShowManageProjects] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Mobile-only state
  const [moveMenuState, setMoveMenuState] = useState(null);
  const [priorityMenuState, setPriorityMenuState] = useState(null);

  // Desktop sorting state
  const [sortField, setSortField] = useState(null); // 'due_date' | 'updated_at' | null
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [projectLock, setProjectLock] = useState(false);

  // Desktop: collapsed Archived column
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);

  // Resize tracking
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // DnD sensors — empty on mobile
  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const mobileSensors = useSensors();

  // Set header actions for Layout
  useEffect(() => {
    setHeaderActions?.({
      onMembers: () => setShowMembers(true),
      onSettings: () => setShowManageProjects(true),
    });
    return () => setHeaderActions?.(null);
  }, [setHeaderActions]);

  // Load data
  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        api.getTasks(workspaceId),
        api.getProjects(workspaceId),
      ]);
      setTasks(t);
      setProjects(p);
    } catch (e) {
      console.error('Failed to load workspace:', e);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtering ──────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (filterProject === 'all') return tasks;
    if (filterProject === 'none') return tasks.filter(t => !t.project_id);
    return tasks.filter(t => String(t.project_id) === String(filterProject));
  }, [tasks, filterProject]);

  // ─── Sorting helper ────────────────────────────────────
  const sortTasks = useCallback((taskList) => {
    if (!sortField) return taskList;

    const sorted = [...taskList];

    if (projectLock && filterProject === 'all') {
      // Group by project, sort within each group
      const groups = new Map();
      sorted.forEach(t => {
        const key = t.project_id || '__no_project__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      });

      // Sort within each group
      groups.forEach((groupTasks) => {
        groupTasks.sort((a, b) => compareTasks(a, b, sortField, sortDir));
      });

      // Flatten groups back
      const result = [];
      groups.forEach((groupTasks) => result.push(...groupTasks));
      return result;
    }

    sorted.sort((a, b) => compareTasks(a, b, sortField, sortDir));
    return sorted;
  }, [sortField, sortDir, projectLock, filterProject]);

  function compareTasks(a, b, field, dir) {
    const aVal = a[field];
    const bVal = b[field];

    // Tasks WITHOUT due_date always go to bottom
    if (field === 'due_date') {
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;  // a goes to bottom
      if (!bVal) return -1; // b goes to bottom
    }

    // For updated_at — nulls to bottom too
    if (!aVal && !bVal) return 0;
    if (!aVal) return 1;
    if (!bVal) return -1;

    const aTime = new Date(aVal).getTime();
    const bTime = new Date(bVal).getTime();
    return dir === 'asc' ? aTime - bTime : bTime - aTime;
  }

  const columnTasks = useMemo(() => {
    const map = {};
    COLUMNS.forEach(c => { map[c.id] = []; });
    filteredTasks.forEach(t => {
      if (map[t.status]) map[t.status].push(t);
    });
    // Apply sorting to each column
    if (sortField) {
      COLUMNS.forEach(c => { map[c.id] = sortTasks(map[c.id]); });
    }
    return map;
  }, [filteredTasks, sortField, sortDir, projectLock, sortTasks]);

  const taskCounts = useMemo(() => {
    const c = {};
    COLUMNS.forEach(col => { c[col.id] = (columnTasks[col.id] || []).length; });
    return c;
  }, [columnTasks]);

  // ─── Sort toggle handlers ──────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField(null); setSortDir('asc'); } // third click → clear
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ─── Task CRUD ──────────────────────────────────────────
  const handleSaveTask = async (payload) => {
    if (selectedTask?.id) {
      await api.updateTask(selectedTask.id, payload);
    } else {
      await api.createTask({ ...payload, workspace_id: workspaceId });
    }
    setSelectedTask(null);
    setShowNewTask(false);
    loadData();
  };

  const handleDeleteTask = async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await api.deleteTask(task.id);
    setSelectedTask(null);
    loadData();
  };

  const handleQuickAdd = async (data) => {
    try {
      await api.createTask({ ...data, workspace_id: workspaceId });
      loadData();
    } catch (e) {
      console.error('Quick add failed:', e);
    }
  };

  const handlePriorityChange = async (taskId, newPriority) => {
    try {
      await api.updateTask(taskId, { priority: newPriority });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
    } catch (e) { console.error('Priority change failed:', e); }
  };

  const handleMoveTask = async (taskId, newStatus) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setMoveMenuState(null);
    } catch (e) { console.error('Move failed:', e); }
  };

  // ─── Mobile handlers ───────────────────────────────────
  const handleLongPress = useCallback((task, position) => {
    setMoveMenuState({ task, position });
  }, []);

  const handlePriorityTap = useCallback((task, position) => {
    setPriorityMenuState({ task, position });
  }, []);

  // ─── DnD (desktop only) — supports cross-column ───────
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // over.id could be a task ID or a column ID (from useDroppable)
    const overTask = tasks.find(t => t.id === over.id);
    const targetCol = overTask ? overTask.status : over.id;

    if (task.status !== targetCol && COLUMNS.some(c => c.id === targetCol)) {
      await handleMoveTask(taskId, targetCol);
    }
  };

  // ─── Project helpers ───────────────────────────────────
  const getProject = (projectId) => projects.find(p => String(p.id) === String(projectId));

  const handleProjectCreated = () => { loadData(); };
  const handleProjectsUpdated = () => { loadData(); };

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="workspace-page">
        <div className="flex items-center justify-center" style={{ height: '50vh' }}>
          <Loader2 size={32} className="animate-spin" />
        </div>
      </div>
    );
  }

  // ─── MOBILE RENDER ─────────────────────────────────────
  if (isMobile) {
    return (
      <div className="workspace-page">
        <div className="kanban-header">
          <div className="kanban-header-left">
            {projects.length > 0 && (
              <select className="project-filter" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                <option value="all">All Projects</option>
                <option value="none">No Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className="kanban-header-right">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowMembers(true)} title="Members"><Users size={18} /></button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowManageProjects(true)} title="Manage Projects"><Settings size={18} /></button>
          </div>
        </div>

        <div className="kanban-board">
          {COLUMNS.map(col => (
            <div key={col.id} className={`kanban-column ${activeColumn === col.id ? 'mobile-active' : ''}`}>
              <div className="column-tasks">
                {(columnTasks[col.id] || []).map(task => (
                  <MobileTaskCard
                    key={task.id}
                    task={task}
                    project={getProject(task.project_id)}
                    onClick={(t) => setSelectedTask(t)}
                    onLongPress={handleLongPress}
                    onPriorityTap={handlePriorityTap}
                  />
                ))}
                {(columnTasks[col.id] || []).length === 0 && (
                  <div className="column-empty">No tasks</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <MobileNav
          activeColumn={activeColumn}
          onColumnChange={setActiveColumn}
          taskCounts={taskCounts}
          onQuickAdd={handleQuickAdd}
        />

        {/* Popups */}
        {moveMenuState && (
          <MoveMenu
            task={moveMenuState.task}
            position={moveMenuState.position}
            onMove={(status) => handleMoveTask(moveMenuState.task.id, status)}
            onDelete={() => { handleDeleteTask(moveMenuState.task); setMoveMenuState(null); }}
            onClose={() => setMoveMenuState(null)}
          />
        )}
        {priorityMenuState && (
          <PriorityMenu
            task={priorityMenuState.task}
            position={priorityMenuState.position}
            onSelect={handlePriorityChange}
            onClose={() => setPriorityMenuState(null)}
          />
        )}
        {selectedTask && (
          <TaskModal task={selectedTask} projects={projects} onClose={() => setSelectedTask(null)} onSave={handleSaveTask} onDelete={handleDeleteTask} />
        )}
        {showNewProject && <NewProjectModal workspaceId={workspaceId} onClose={() => setShowNewProject(false)} onCreated={handleProjectCreated} />}
        {showManageProjects && <ManageProjectsModal projects={projects} onClose={() => setShowManageProjects(false)} onUpdate={handleProjectsUpdated} />}
        {showMembers && <MembersModal workspaceId={workspaceId} onClose={() => setShowMembers(false)} />}
      </div>
    );
  }

  // ─── DESKTOP RENDER ────────────────────────────────────
  return (
    <div className="workspace-page desktop">
      <div className="kanban-header">
        <div className="kanban-header-left">
          {projects.length > 0 && (
            <select className="project-filter" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="all">All Projects</option>
              <option value="none">No Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {filterProject === 'all' && (
            <button
              className={`btn btn-ghost btn-sm sort-lock-btn ${projectLock ? 'active' : ''}`}
              onClick={() => setProjectLock(!projectLock)}
              title={projectLock ? 'Project Lock ON — tasks grouped by project' : 'Project Lock OFF — all tasks mixed'}
            >
              {projectLock ? <Lock size={14} /> : <Unlock size={14} />}
              <span className="sort-lock-label">Project Lock</span>
            </button>
          )}
        </div>
        <div className="kanban-header-right">
          <button
            className={`btn btn-ghost btn-sm sort-btn ${sortField === 'due_date' ? 'active' : ''}`}
            onClick={() => toggleSort('due_date')}
            title="Sort by Due Date"
          >
            <ArrowUpDown size={14} />
            Due Date {sortField === 'due_date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
          <button
            className={`btn btn-ghost btn-sm sort-btn ${sortField === 'updated_at' ? 'active' : ''}`}
            onClick={() => toggleSort('updated_at')}
            title="Sort by Last Updated"
          >
            <ArrowUpDown size={14} />
            Last Updated {sortField === 'updated_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNewProject(true)}><FolderOpen size={16} /> New Project</button>
        </div>
      </div>

      <DndContext sensors={desktopSensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colTasks = columnTasks[col.id] || [];
            const isArchived = col.id === 'archived';
            const isCollapsed = isArchived && archivedCollapsed;

            if (isCollapsed) {
              return (
                <DroppableColumn key={col.id} id={col.id} className="kanban-column collapsed-column">
                  <div className="collapsed-column-inner" onClick={() => setArchivedCollapsed(false)} title="Expand Archived">
                    <span className="column-icon">{col.icon}</span>
                    <span className="collapsed-column-title">{col.title}</span>
                    <span className="column-count">{colTasks.length}</span>
                  </div>
                </DroppableColumn>
              );
            }

            return (
              <DroppableColumn key={col.id} id={col.id} className={`kanban-column ${isArchived ? 'archived-expanded' : ''}`}>
                <div className="column-header">
                  <span className="column-icon">{col.icon}</span>
                  <h3 className="column-title">{col.title}</h3>
                  <span className="column-count">{colTasks.length}</span>
                  {isArchived && (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setArchivedCollapsed(true)} title="Collapse" style={{ marginLeft: 'auto' }}>
                      {'«'}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-icon btn-sm column-add" onClick={() => { setNewTaskColumn(col.id); setShowNewTask(true); }} title="Add task">
                    <Plus size={16} />
                  </button>
                </div>
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="column-tasks">
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        project={getProject(task.project_id)}
                        onClick={(t) => setSelectedTask(t)}
                        onPriorityChange={handlePriorityChange}
                        onDelete={handleDeleteTask}
                      />
                    ))}
                    {colTasks.length === 0 && <div className="column-empty">No tasks</div>}
                  </div>
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>
      </DndContext>

      {/* Modals */}
      {selectedTask && (
        <TaskModal task={selectedTask} projects={projects} onClose={() => setSelectedTask(null)} onSave={handleSaveTask} onDelete={handleDeleteTask} />
      )}
      {showNewTask && (
        <TaskModal task={{ status: newTaskColumn }} projects={projects} onClose={() => setShowNewTask(false)} onSave={handleSaveTask} />
      )}
      {showNewProject && <NewProjectModal workspaceId={workspaceId} onClose={() => setShowNewProject(false)} onCreated={handleProjectCreated} />}
      {showManageProjects && <ManageProjectsModal projects={projects} onClose={() => setShowManageProjects(false)} onUpdate={handleProjectsUpdated} />}
      {showMembers && <MembersModal workspaceId={workspaceId} onClose={() => setShowMembers(false)} />}
    </div>
  );
}
