import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username, password);

    if (!result.success) {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-screen bg-(--neo-bg) flex items-center justify-center p-4 font-sans">
      {/* Background Pattern */}
      <div className="fixed inset-0 playground-grid opacity-30" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="w-16 h-16 bg-[#818cf8] border-4 border-black flex items-center justify-center font-black text-4xl text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            P
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-black uppercase">Panon</h1>
            <p className="text-[11px] text-black font-black uppercase tracking-[0.3em] opacity-50">
              Builder v1.0
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight text-black">Sign In</h2>
            <p className="text-sm font-bold text-black/50 mt-1 uppercase tracking-wider">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-50 border-3 border-red-500 p-3 flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-black text-red-600 uppercase">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-black mb-2">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="neo-input w-full text-base"
                placeholder="Enter username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-black mb-2">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neo-input w-full text-base"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading || !username || !password}
              className={`mt-2 w-full py-4 border-4 border-black text-base font-black uppercase tracking-widest transition-all ${
                isLoading || !username || !password
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#818cf8] text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-3 border-black border-t-transparent animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30">
            Solana Automation Platform
          </p>
        </div>
      </div>
    </div>
  );
};
