import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, ClipboardList, RefreshCw, Clock, Activity } from 'lucide-react';
import api from '../utils/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeView, setActiveView] = useState('sessions');

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/intake/today');
      if (data.success) setSessions(data.data);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const statusBadge = (status) => {
    const styles = {
      in_progress: 'bg-amber-100 text-amber-800',
      completed: 'bg-emerald-100 text-emerald-800',
      reviewed: 'bg-blue-100 text-blue-800',
    };
    const labels = { in_progress: 'In Progress', completed: 'Completed', reviewed: 'Reviewed' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const completedCount = sessions.filter(s => s.status === 'completed' || s.status === 'reviewed').length;
  const pendingCount = sessions.filter(s => s.status === 'in_progress').length;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-semibold text-teal-700">MediKiosk</h1>
          <p className="text-xs text-slate-500 mt-1">{user?.hospitalName || 'Doctor Portal'}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Overview"
            active={activeView === 'overview'}
            onClick={() => setActiveView('overview')}
          />
          <NavItem
            icon={<ClipboardList className="h-5 w-5" />}
            label="Intake Sessions"
            active={activeView === 'sessions'}
            onClick={() => setActiveView('sessions')}
            badge={sessions.length}
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-slate-900">{user?.fullName}</p>
            <p className="text-xs text-slate-500">{user?.specialty || 'Doctor'}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center p-2.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {activeView === 'overview' ? 'Overview' : 'Intake Sessions'}
            </h2>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <button
            onClick={() => { setLoadingSessions(true); fetchSessions(); }}
            className="flex items-center text-sm text-slate-600 hover:text-teal-700 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingSessions ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        <main className="p-6">
          {activeView === 'overview' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Sessions" value={sessions.length} icon={<ClipboardList className="h-5 w-5 text-teal-700" />} />
                <StatCard title="Completed" value={completedCount} icon={<Activity className="h-5 w-5 text-emerald-600" />} />
                <StatCard title="In Progress" value={pendingCount} icon={<Clock className="h-5 w-5 text-amber-600" />} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-medium text-slate-800 mb-2">Welcome, {user?.fullName}</h3>
                <p className="text-sm text-slate-500">View intake sessions to review AI-generated clinical summaries from patient check-ins.</p>
                <button
                  onClick={() => setActiveView('sessions')}
                  className="mt-4 text-sm text-teal-700 font-medium hover:text-teal-800 transition-colors"
                >
                  View Intake Sessions
                </button>
              </div>
            </div>
          ) : (
            <div>
              {loadingSessions ? (
                <div className="text-center py-12 text-slate-500">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">No sessions yet</h3>
                  <p className="text-sm text-slate-500 mt-1">Patient intake sessions will appear here as patients complete their check-in.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => navigate(`/session/${session.id}`)}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-teal-300 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{session.patient_name}</h4>
                          {session.abha_id && <p className="text-xs text-slate-500 mt-0.5">ABHA: {session.abha_id}</p>}
                          {session.chief_complaint && <p className="text-sm text-slate-600 mt-1">{session.chief_complaint}</p>}
                        </div>
                        <div className="flex items-center space-x-3">
                          {statusBadge(session.status)}
                          <span className="text-xs text-slate-400">{timeAgo(session.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors text-sm ${active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <div className="flex items-center">
        <span className="mr-3">{icon}</span>
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-teal-100 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center">
      <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center mr-4">{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
