import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Bell, X, Check } from 'lucide-react';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const markReadTimer = useRef(null);

  // Poll unread count
  useEffect(() => {
    loadCount();
    const iv = setInterval(loadCount, 30000);
    return () => clearInterval(iv);
  }, []);

  // Load full list + mark-read timer when open
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      markReadTimer.current = setTimeout(() => {
        if (unreadCount > 0) markAllRead();
      }, 2000);
    } else if (markReadTimer.current) {
      clearTimeout(markReadTimer.current);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadCount = async () => {
    try { setUnreadCount((await api.getNotificationCount()).unread_count); }
    catch (e) { console.error('Failed to load notification count:', e); }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try { setNotifications(await api.getNotifications(50)); }
    catch (e) { console.error('Failed to load notifications:', e); }
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (e) { console.error('Failed to mark read:', e); }
  };

  const handleClick = (n) => {
    if (n.data?.workspace_id) navigate(`/workspace/${n.data.workspace_id}`);
    setIsOpen(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) { console.error('Failed to delete notification:', e); }
  };

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getIcon = (type) => {
    const map = { member_joined: '\u{1F44B}', member_left: '\u{1F44B}', task_moved: '\u{1F4E6}', task_update: '\u{1F4AC}', task_update_reply: '\u{1F4AC}' };
    return map[type] || '\u{1F514}';
  };

  // Group by day
  const grouped = (() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const weekAgo = Date.now() - 604800000;
    const g = { today: [], yesterday: [], thisWeek: [], older: [] };
    notifications.forEach(n => {
      const d = new Date(n.created_at);
      const ds = d.toDateString();
      if (ds === today) g.today.push(n);
      else if (ds === yesterday) g.yesterday.push(n);
      else if (d.getTime() > weekAgo) g.thisWeek.push(n);
      else g.older.push(n);
    });
    return g;
  })();

  const renderGroup = (label, items) => {
    if (!items.length) return null;
    return (
      <>
        <div className="notification-group-title">{label}</div>
        {items.map(n => (
          <div key={n.id} className={`notification-item ${!n.read_at ? 'unread' : ''}`} onClick={() => handleClick(n)}>
            <div className="notification-icon">{getIcon(n.type)}</div>
            <div className="notification-content">
              <div className="notification-title">{n.title}</div>
              <div className="notification-message">{n.message}</div>
              <div className="notification-time">{formatTime(n.created_at)}</div>
            </div>
            <button className="notification-delete" onClick={(e) => handleDelete(e, n.id)} title="Delete"><X size={14} /></button>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className={`btn btn-ghost btn-icon notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead} title="Mark all as read">
                <Check size={16} />
              </button>
            )}
          </div>
          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={32} />
                <p>No notifications</p>
              </div>
            ) : (
              <>
                {renderGroup('Today', grouped.today)}
                {renderGroup('Yesterday', grouped.yesterday)}
                {renderGroup('This Week', grouped.thisWeek)}
                {renderGroup('Older', grouped.older)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
