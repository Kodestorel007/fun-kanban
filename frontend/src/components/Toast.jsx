import { useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type = 'success', duration = 3000 } = e.detail;
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    };
    window.addEventListener('show-toast', handler);
    return () => window.removeEventListener('show-toast', handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <Check size={18} />}
          {t.type === 'error' && <AlertCircle size={18} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
