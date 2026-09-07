import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('doctor@hospital.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleQuickLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    const res = await login(email || 'doctor@hospital.com', password || 'Password@123');
    if (!res.success) {
      setError(res.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-teal-50 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-teal-700" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-slate-900">MediKiosk</h2>
          <p className="mt-1 text-sm text-slate-500">Doctor Portal</p>
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Doctor Account</label>
            <input
              id="email"
              type="email"
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
              placeholder="doctor@hospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</div>
          )}

          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entering Portal...' : (
              <>
                Enter Doctor Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>

          <div className="pt-3 border-t border-slate-100 text-center">
            <a
              href="/patient"
              className="inline-flex items-center text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors"
            >
              Open Patient Check-In Kiosk &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
