import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export const WorkspaceSelector = () => {
    const { currentWorkspace, workspaces, selectWorkspace, createWorkspace, updateWorkspace } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [network, setNetwork] = useState<'mainnet' | 'devnet'>('devnet');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newWorkspaceName.trim()) {
            await createWorkspace(newWorkspaceName.trim(), network);
            setNewWorkspaceName('');
            setIsCreating(false);
            setIsOpen(false);
        }
    };

    const handleRename = async (e: React.MouseEvent, id: number, currentName: string) => {
        e.stopPropagation();
        const ws = workspaces.find(w => w.workspaceId === id);
        if (!ws) return;
        const newName = window.prompt('Enter new workspace name:', currentName);
        if (newName && newName.trim() && newName !== currentName) {
            await updateWorkspace(id, newName.trim(), ws.network);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px transition-all"
            >
                <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Workspace</span>
                    <span className="text-sm font-black uppercase truncate max-w-[150px] flex items-center gap-2">
                        {currentWorkspace?.name || 'Select Workspace'}
                        {currentWorkspace && (
                            <span className={`text-[8px] px-1 border border-black leading-none py-0.5 ${currentWorkspace.network === 'mainnet' ? 'bg-orange-400' : 'bg-blue-400'}`}>
                                {currentWorkspace.network === 'mainnet' ? 'M' : 'D'}
                            </span>
                        )}
                    </span>
                </div>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-50">
                    <div className="p-2 max-h-60 overflow-y-auto">
                        {workspaces.map((ws) => (
                            <div key={ws.workspaceId} className="flex gap-1 mb-1">
                                <button
                                    onClick={() => {
                                        selectWorkspace(ws.workspaceId);
                                        setIsOpen(false);
                                    }}
                                    className={`flex-1 text-left px-4 py-3 text-sm font-black uppercase hover:bg-slate-100 border-2 transition-colors flex items-center justify-between ${currentWorkspace?.workspaceId === ws.workspaceId ? 'border-black bg-emerald-50' : 'border-transparent'}`}
                                >
                                    <span>{ws.name}</span>
                                    <span className={`text-[8px] px-1 border border-black leading-none py-0.5 ${ws.network === 'mainnet' ? 'bg-orange-400 text-black' : 'bg-blue-400 text-black'}`}>
                                        {ws.network === 'mainnet' ? 'MAINNET' : 'DEVNET'}
                                    </span>
                                </button>
                                <button
                                    onClick={(e) => handleRename(e, ws.workspaceId, ws.name)}
                                    className="px-3 border-2 border-transparent hover:border-slate-800 hover:bg-slate-50 text-slate-300 hover:text-black transition-all"
                                    title="Rename Workspace"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border-t-4 border-black p-2 bg-slate-50">
                        {isCreating ? (
                            <form onSubmit={handleCreate} className="flex flex-col gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newWorkspaceName}
                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                    placeholder="Workspace Name..."
                                    className="w-full px-3 py-2 border-2 border-black text-xs font-black uppercase outline-none focus:bg-white"
                                />
                                <div className="flex border-2 border-black">
                                    <button
                                        type="button"
                                        onClick={() => setNetwork('mainnet')}
                                        className={`flex-1 py-1 text-[9px] font-black uppercase transition-colors ${network === 'mainnet' ? 'bg-orange-400 text-black' : 'bg-white hover:bg-slate-100'}`}
                                    >
                                        Mainnet
                                    </button>
                                    <div className="w-[2px] bg-black" />
                                    <button
                                        type="button"
                                        onClick={() => setNetwork('devnet')}
                                        className={`flex-1 py-1 text-[9px] font-black uppercase transition-colors ${network === 'devnet' ? 'bg-blue-400 text-black' : 'bg-white hover:bg-slate-100'}`}
                                    >
                                        Devnet
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        className="flex-1 py-2 bg-black text-white text-[10px] font-black uppercase hover:bg-slate-800"
                                    >
                                        Create
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="px-3 py-2 border-2 border-black text-[10px] font-black uppercase hover:bg-white"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-400 text-[10px] font-black uppercase text-slate-500 hover:border-black hover:text-black transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                                </svg>
                                New Workspace
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
