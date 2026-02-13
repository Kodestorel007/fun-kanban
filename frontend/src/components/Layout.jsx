import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayColor } from '../utils/themeColors';
import api from '../api/client';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutDashboard, FolderKanban, LogOut, Moon, Sun, Menu,
  Shield, Users, Settings, GripVertical,
} from 'lucide-react';
import NotificationBell from './NotificationBell';

// Bridge configuration (env vars)
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || '';

// ─── Sortable Workspace Item ──────────────────────────────
function SortableWorkspace({ workspace, theme }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: workspace.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const displayColor = getDisplayColor(workspace.color, theme);

  return (
    <div ref={setNodeRef} style={style} className="sortable-workspace-wrapper">
      <NavLink to={`/workspace/${workspace.id}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="workspace-color" style={{ background: displayColor }} />
        <span>{workspace.name}</span>
        <span className="drag-handle" {...attributes} {...listeners} style={{ marginLeft: 'auto' }}>
          <GripVertical size={14} />
        </span>
      </NavLink>
    </div>
  );
}

// ─── Layout (App Shell) ───────────────────────────────────
export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [workspaces, setWorkspaces] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('checking');
  const [pingStatus, setPingStatus] = useState(null);
  const [features, setFeatures] = useState({ show_pip_button: false });
  const [headerActions, setHeaderActions] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ── Resize tracking ──
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── DnD sensors — disabled on mobile ──
  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const mobileSensors = useSensors(); // empty — no drag on mobile

  // ── Special workspace (bridge ping) ──
  const currentWsId = location.pathname.startsWith('/workspace/') ? location.pathname.split('/')[2] : null;
  const currentWs = workspaces.find(w => String(w.id) === String(currentWsId));
  const showBridge = features.show_pip_button && currentWs?.name === 'Pip-AI';

  useEffect(() => {
    loadWorkspaces();
    loadFeatures();
  }, []);

  useEffect(() => {
    if (!features.show_pip_button || !BRIDGE_URL) return;
    checkBridge();
    const iv = setInterval(checkBridge, 30000);
    return () => clearInterval(iv);
  }, [features.show_pip_button]);

  // Close sidebar on navigate (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const loadWorkspaces = async () => {
    try { setWorkspaces(await api.getWorkspaces()); }
    catch (e) { console.error('Failed to load workspaces:', e); }
  };

  const loadFeatures = async () => {
    try { setFeatures(await api.getFeatures()); }
    catch (e) { console.error('Failed to load features:', e); }
  };

  const checkBridge = async () => {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${BRIDGE_URL}/`, { signal: ctrl.signal });
      clearTimeout(tid);
      setBridgeStatus(r.ok ? 'online' : 'offline');
    } catch { setBridgeStatus('offline'); }
  };

  const pingBridge = async () => {
    setPingStatus('pinging');
    try {
      const r = await fetch(`${BRIDGE_URL}/ping`, { method: 'POST' });
      const d = await r.json();
      setPingStatus(d.status === 'ok' ? 'success' : 'error');
    } catch { setPingStatus('error'); }
    setTimeout(() => setPingStatus(null), 3000);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = workspaces.findIndex(w => w.id === active.id);
    const newIdx = workspaces.findIndex(w => w.id === over.id);
    const reordered = arrayMove(workspaces, oldIdx, newIdx);
    setWorkspaces(reordered);
    try { await api.reorderWorkspaces(reordered.map(w => w.id)); }
    catch { loadWorkspaces(); }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Dashboard';
    if (location.pathname === '/admin') return 'Admin Panel';
    if (location.pathname.startsWith('/workspace/')) {
      const ws = workspaces.find(w => w.id === location.pathname.split('/')[2]);
      return ws?.name || 'Workspace';
    }
    return 'Fun Kanban';
  };

  return (
    <div className="app-layout">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><FolderKanban size={20} /></div>
          <span className="sidebar-title">Fun Kanban</span>
          <span className="sidebar-version">V2.1</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={20} /><span>Dashboard</span>
            </NavLink>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Workspaces</div>
            {workspaces.length === 0 ? (
              <div className="nav-item text-muted" style={{ cursor: 'default' }}>No workspaces yet</div>
            ) : (
              <DndContext sensors={isMobile ? mobileSensors : desktopSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={workspaces.map(w => w.id)} strategy={verticalListSortingStrategy}>
                  {workspaces.map(ws => <SortableWorkspace key={ws.id} workspace={ws} theme={theme} />)}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {user?.is_admin && (
            <div className="nav-section">
              <div className="nav-section-title">Administration</div>
              <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Shield size={20} /><span>Admin Panel</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-menu" onClick={handleLogout} title="Logout">
            <div className="user-avatar">{getInitials(user?.display_name)}</div>
            <div className="user-info">
              <div className="user-name">{user?.display_name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <LogOut size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="sidebar-copyright">&copy; Bid Point Solutions 2026</div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <button className="btn btn-ghost mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="header-title">{getPageTitle()}</h1>
            {headerActions && (
              <div className="header-workspace-actions">
                <button className="btn btn-ghost btn-icon" onClick={headerActions.onMembers} title="Members"><Users size={20} /></button>
                <button className="btn btn-ghost btn-icon" onClick={headerActions.onSettings} title="Manage Projects"><Settings size={20} /></button>
              </div>
            )}
          </div>
          <div className="header-right">
            {showBridge && (
              <>
                {pingStatus === 'success' && <span className="ping-status-inline success">Ping sent!</span>}
                {pingStatus === 'error' && <span className="ping-status-inline error">Failed</span>}
                <button
                  className={`btn btn-ping-bridge ${bridgeStatus === 'online' ? 'bridge-online' : 'bridge-offline'} ${pingStatus || ''}`}
                  onClick={pingBridge}
                  disabled={pingStatus === 'pinging' || bridgeStatus === 'offline'}
                  title={bridgeStatus === 'offline' ? 'Bridge offline' : 'Ping Pip'}
                >
                  {pingStatus === 'pinging' ? '\u23F3' : pingStatus === 'success' ? '\u2713' : '\u{1F431}'}
                </button>
              </>
            )}
            <NotificationBell />
            <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <div className="page-content">
          <Outlet context={{ workspaces, reloadWorkspaces: loadWorkspaces, setHeaderActions }} />
        </div>
      </main>
    </div>
  );
}
