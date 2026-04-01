import { useState } from 'react';
import { useKey } from '../context/KeyContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { API_URL, authFetch } from '../utils/api';

interface KeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyModal = ({ isOpen, onClose }: KeyModalProps) => {
  const { address } = useKey();
  const { currentWorkspace } = useWorkspace();
  const [isRevealing, setIsRevealing] = useState(false);
  const [password, setPassword] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.walletId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(`${API_URL}/wallet/${currentWorkspace.walletId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      if (response.ok) {
        setRevealedKey(data.privateKey);
      } else {
        setError(data.error || 'Failed to reveal. Please check your password.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setIsRevealing(false);
    setPassword('');
    setRevealedKey(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white border-4 border-black p-8 max-w-lg w-full shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transform transition-all duration-300">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none italic">
            Wallet Info
          </h2>
          <button 
            onClick={handleClose}
            className="w-10 h-10 border-4 border-black flex items-center justify-center font-black hover:bg-red-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {address && (
          <div className="space-y-8">
            {/* Address Section */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-black rounded-sm blur opacity-5 group-hover:opacity-10 transition duration-300"></div>
              <div className="relative p-6 bg-amber-50 border-4 border-black">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                    Public Address
                  </p>
                  <button 
                    onClick={() => handleCopy(address)}
                    className="text-[10px] font-black uppercase underline hover:no-underline"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-sm break-all font-bold text-black selection:bg-amber-200 p-2 bg-white/50 border-2 border-black/10">
                  {address}
                </p>
              </div>
            </div>

            {/* Reveal Private Key Section */}
            {!revealedKey ? (
              <div className="space-y-4">
                {!isRevealing ? (
                  <button
                    onClick={() => setIsRevealing(true)}
                    className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-sm hover:translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] transition-all flex items-center justify-center gap-3 active:translate-x-0 active:translate-y-0 active:shadow-none"
                  >
                    <span className="text-xl">🔓</span> Reveal Private Key
                  </button>
                ) : (
                  <form onSubmit={handleReveal} className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="p-6 bg-red-50 border-4 border-black">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-red-600 mb-4 flex items-center gap-2">
                        <span className="animate-pulse">⚠️</span> Sensitive data access
                      </p>
                      <input
                        autoFocus
                        type="password"
                        placeholder="Enter account password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-4 bg-white border-4 border-black font-bold focus:outline-none focus:ring-0 focus:border-red-500 placeholder:text-black/20"
                      />
                      {error && (
                        <p className="mt-3 text-[10px] font-black text-red-600 uppercase tracking-tight">
                          Error: {error}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setIsRevealing(false)}
                        className="px-6 py-4 border-4 border-black font-black uppercase tracking-widest text-xs hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="flex-1 py-4 bg-red-500 text-white border-4 border-black font-black uppercase tracking-widest text-xs hover:translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:grayscale disabled:hover:translate-x-0 disabled:hover:-translate-y-0 disabled:hover:shadow-none"
                      >
                        {isLoading ? 'Verifying...' : 'Unlock Key'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="animate-in zoom-in-95 duration-300">
                <div className="p-6 bg-emerald-500 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                      Your Private Key
                    </p>
                    <div className="flex gap-4">
                       <button 
                        onClick={() => handleCopy(revealedKey)}
                        className="text-[10px] font-black uppercase text-white underline hover:no-underline"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-sm break-all font-bold text-black p-4 bg-white/90 border-4 border-black overflow-hidden relative">
                    <div className="absolute inset-0 bg-white/10 pointer-events-none"></div>
                    {revealedKey}
                  </div>
                  <p className="mt-4 text-[9px] font-black text-white uppercase italic text-center">
                    DO NOT SHARE THIS KEY! ANYONE WITH THIS KEY CAN CONTROL YOUR ASSETS.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full mt-6 py-4 bg-black text-white font-black uppercase tracking-widest text-sm hover:translate-x-1 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                >
                  Confirm & Hide
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
