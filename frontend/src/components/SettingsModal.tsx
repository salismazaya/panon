import { useState, useEffect, type FormEvent } from 'react';
import Modal from 'react-modal';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, updateProfile, logout } = useAuth();
  const { currentWorkspace, updateWorkspace } = useWorkspace();
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [wsName, setWsName] = useState(currentWorkspace?.name || '');
  const [wsNetwork, setWsNetwork] = useState<'mainnet' | 'devnet'>(currentWorkspace?.network || 'devnet');

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name);
      setWsNetwork(currentWorkspace.network);
    }
  }, [currentWorkspace]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'username' | 'password' | 'workspace'>('username');

  const resetForm = () => {
    setUsername('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleUsernameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    setIsLoading(true);
    const result = await updateProfile({ username: username.trim(), currentPassword });
    setIsLoading(false);

    if (result.success) {
      setSuccess('Username updated successfully!');
      setUsername('');
      setCurrentPassword('');
    } else {
      setError(result.error || 'Failed to update username');
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    if (!newPassword) {
      setError('New password is required');
      return;
    }

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const result = await updateProfile({ currentPassword, newPassword });
    setIsLoading(false);

    if (result.success) {
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setError(result.error || 'Failed to update password');
    }
  };

  const handleWorkspaceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentWorkspace) return;

    if (!wsName.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsLoading(true);
    try {
      await updateWorkspace(currentWorkspace.workspaceId, wsName.trim(), wsNetwork);
      setSuccess('Workspace updated successfully!');
    } catch (err) {
      setError('Failed to update workspace');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      closeTimeoutMS={200}
      ariaHideApp={false}
    >
      <div className="bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-black bg-[#818cf8]">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-black">Settings</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mt-1">
              Account: {user?.username}
            </p>
          </div>
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center border-3 border-black bg-white hover:bg-red-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b-4 border-black">
          <button
            onClick={() => { setActiveTab('username'); resetForm(); }}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors ${
              activeTab === 'username' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            Change Username
          </button>
          <button
            onClick={() => { setActiveTab('password'); resetForm(); }}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors border-l-4 border-black ${
              activeTab === 'password' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            Change Password
          </button>
          <button
            onClick={() => { setActiveTab('workspace'); resetForm(); setWsName(currentWorkspace?.name || ''); setWsNetwork(currentWorkspace?.network || 'devnet'); }}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors border-l-4 border-black ${
              activeTab === 'workspace' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/5'
            }`}
          >
            Workspace
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border-3 border-red-500 p-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-xs font-black text-red-600 uppercase">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 border-3 border-emerald-500 p-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-black text-emerald-600 uppercase">{success}</span>
            </div>
          )}

          {activeTab === 'username' ? (
            <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  New Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="neo-input w-full"
                  placeholder={user?.username}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="neo-input w-full"
                  placeholder="Verify your identity"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 border-4 border-black text-sm font-black uppercase tracking-widest transition-all ${
                  isLoading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#facc15] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                {isLoading ? 'Updating...' : 'Update Username'}
              </button>
            </form>
          ) : activeTab === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="neo-input w-full"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="neo-input w-full"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="neo-input w-full"
                  placeholder="Confirm new password"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 border-4 border-black text-sm font-black uppercase tracking-widest transition-all ${
                  isLoading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#818cf8] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleWorkspaceSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="neo-input w-full"
                  placeholder="Enter workspace name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black mb-2">
                  Network Mode
                </label>
                <div className="flex border-4 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    type="button"
                    onClick={() => setWsNetwork('mainnet')}
                    className={`flex-1 py-3 text-xs font-black uppercase transition-all ${
                      wsNetwork === 'mainnet' ? 'bg-orange-400 text-black' : 'bg-white text-black hover:bg-slate-50'
                    }`}
                  >
                    Mainnet
                  </button>
                  <div className="w-1 bg-black" />
                  <button
                    type="button"
                    onClick={() => setWsNetwork('devnet')}
                    className={`flex-1 py-3 text-xs font-black uppercase transition-all ${
                      wsNetwork === 'devnet' ? 'bg-blue-400 text-black' : 'bg-white text-black hover:bg-slate-50'
                    }`}
                  >
                    Devnet
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 border-4 border-black text-sm font-black uppercase tracking-widest transition-all ${
                    isLoading
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {isLoading ? 'Saving...' : 'Save Workspace Changes'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer: Logout */}
        <div className="p-6 border-t-4 border-black">
          <button
            onClick={logout}
            className="w-full py-3 border-4 border-black bg-red-400 text-black text-sm font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </Modal>
  );
};
