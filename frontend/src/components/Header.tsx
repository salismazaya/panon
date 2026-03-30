import { useState } from 'react';
import { useFlow } from '../context/FlowContext';
import { useKey } from '../context/KeyContext';
import { useAuth } from '../context/AuthContext';
import { compileToLua } from '../utils/compiler';
import { CodeModal } from './CodeModal';
import { KeyModal } from './KeyModal';
import { WorkspaceSelector } from './WorkspaceSelector';
import { SettingsModal } from './SettingsModal';

export const Header = () => {
    const { nodes, edges, isFlowValid, isSaving, lastError, saveFlow } = useFlow();
    const { address } = useKey();
    const { user } = useAuth();
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const isValid = isFlowValid();

    const handleSave = () => {
        if (isValid && !isSaving) {
            saveFlow();
        }
    };

    const handleGenerate = () => {
        if (!isValid) return;
        const lua = compileToLua(nodes, edges);
        setGeneratedCode(lua);
        setIsCodeModalOpen(true);
    };

    return (
        <header className="absolute top-0 right-0 left-80 h-20 border-b-4 border-black flex items-center justify-between px-8 z-20 bg-white pointer-events-auto">
            <div className="flex items-center gap-6 text-sm font-black text-black uppercase tracking-tight">
                <WorkspaceSelector />
                <span className="flex items-center gap-3">
                    <span className={`w-3 h-3 ${isValid ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'} border-2 border-black`} />
                    Status: <span className="max-w-[150px] truncate">{isValid ? 'Ready' : 'Errors'}</span>
                </span>
            </div>

            <div className="flex items-center gap-6">
                {!isValid && (
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-1 border-2 border-red-600">Fix red nodes to compile</span>
                )}

                {/* Wallet Connection Status */}
                <button
                    onClick={() => setIsKeyModalOpen(true)}
                    className={`flex items-center gap-2 px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-widest transition-all ${address
                        ? 'bg-emerald-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px'
                        : 'bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px'
                        }`}
                >
                    <span className={`w-2 h-2 rounded-full border-2 border-black ${address ? 'bg-emerald-600' : 'bg-yellow-600'}`} />
                    {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Connect Wallet'}
                </button>

                <div className="flex items-center border-2 border-black bg-white p-1">
                    <button className="px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white">Visual</button>
                    <button onClick={handleGenerate} className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-black hover:bg-black/5">Code</button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={!isValid || isSaving}
                        className={`flex items-center gap-2 px-4 py-3 border-4 border-black text-sm font-black uppercase transition-all ${isValid && !isSaving
                            ? 'bg-emerald-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                            }`}
                    >
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save
                    </button>

                    <button
                        onClick={handleGenerate}
                        disabled={!isValid}
                        className={`flex items-center gap-2 px-4 py-3 border-4 border-black text-sm font-black uppercase transition-all ${isValid
                            ? 'bg-[#818cf8] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Code
                    </button>
                </div>

                <div className="flex items-center gap-3 px-4 py-3 border-4 border-black text-sm font-black uppercase bg-white">
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                            <span className="text-black">Saving...</span>
                        </>
                    ) : lastError ? (
                        <>
                            <span className="text-red-600">Sync Error</span>
                            <span className="text-[10px] text-red-400 normal-case hidden lg:block">({lastError})</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-emerald-500">Synced</span>
                        </>
                    )}
                </div>

                {/* User / Settings Button */}
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white font-black uppercase text-xs tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {user?.username || 'User'}
                </button>

            </div>

            <CodeModal
                isOpen={isCodeModalOpen}
                onClose={() => setIsCodeModalOpen(false)}
                code={generatedCode}
            />

            <KeyModal
                isOpen={isKeyModalOpen}
                onClose={() => setIsKeyModalOpen(false)}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </header>
    );
};
