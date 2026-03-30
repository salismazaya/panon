import { useState } from 'react';
import { useFlow } from '../context/FlowContext';
import { useKey } from '../context/KeyContext';
import { useAuth } from '../context/AuthContext';
import { compileToLua } from '../utils/compiler';
import { CodeModal } from './CodeModal';
import { KeyModal } from './KeyModal';
import { WorkspaceSelector } from './WorkspaceSelector';
import { SettingsModal } from './SettingsModal';

export const Header = ({ onToggleSidebar }: { onToggleSidebar: () => void }) => {
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
        <header className="h-20 border-b-4 border-black flex items-center justify-between px-4 lg:px-8 z-20 bg-white shrink-0">
            {/* Left Section: Workspace & Global Status */}
            <div className="flex items-center gap-2 lg:gap-8 min-w-0">
                {/* Hamburger menu for mobile */}
                <button
                    onClick={onToggleSidebar}
                    className="lg:hidden p-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                </button>

                <div className="hidden sm:block">
                    <WorkspaceSelector />
                </div>

                <div className="hidden md:flex items-center gap-3 px-4 py-2 border-2 border-black bg-slate-50">
                    <span className={`w-3 h-3 ${isValid ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'} border-2 border-black`} />
                    <span className="text-[11px] font-black uppercase tracking-tight text-black">
                        Status: <span className={isValid ? 'text-emerald-600' : 'text-red-600'}>{isValid ? 'Ready' : 'Incomplete'}</span>
                    </span>
                    {!isValid && (
                        <span className="ml-2 text-[10px] font-black text-red-600 uppercase tracking-widest bg-white px-2 py-0.5 border-2 border-red-600 whitespace-nowrap">
                            Fix red nodes
                        </span>
                    )}
                </div>
            </div>

            {/* Right Section: Actions & Profile */}
            <div className="flex items-center gap-2 lg:gap-4">
                {/* Mode Toggle - hidden on small mobile */}
                <div className="hidden sm:flex items-center border-[3px] border-black bg-white p-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <button className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white">Visual</button>
                    <button onClick={handleGenerate} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black hover:bg-black/5">Code</button>
                </div>

                <div className="hidden md:block h-8 w-[2px] bg-black/10 mx-1" />

                {/* Wallet Button - shortened text on mobile */}
                <button
                    onClick={() => setIsKeyModalOpen(true)}
                    className={`flex items-center gap-2 px-3 py-2 border-2 border-black font-black uppercase text-[10px] tracking-widest transition-all ${address
                        ? 'bg-emerald-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                >
                    <span className={`w-2 h-2 rounded-full border-2 border-black ${address ? 'bg-emerald-600' : 'bg-yellow-600'}`} />
                    <span className="hidden sm:inline">{address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'No Wallet'}</span>
                    <span className="sm:hidden">{address ? 'Wallet' : 'None'}</span>
                </button>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={!isValid || isSaving}
                        className={`flex items-center gap-2 px-3 lg:px-4 py-2 border-[3px] border-black text-xs font-black uppercase transition-all ${isValid && !isSaving
                            ? 'bg-emerald-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                        title="Save Flow"
                    >
                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        <span className="hidden lg:inline">Save</span>
                    </button>

                    <button
                        onClick={handleGenerate}
                        disabled={!isValid}
                        className={`flex items-center gap-2 px-3 lg:px-4 py-2 border-[3px] border-black text-xs font-black uppercase transition-all ${isValid
                            ? 'bg-[#818cf8] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                        title="View Code"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span className="hidden lg:inline">Code</span>
                    </button>
                </div>

                {/* Sync Status Badge - hidden on small mobile */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 border-[3px] border-black text-[10px] font-black uppercase bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {isSaving ? (
                        <>
                            <div className="w-3 h-3 border-2 border-black border-t-transparent animate-spin" />
                            <span className="hidden md:inline text-black">Saving</span>
                        </>
                    ) : lastError ? (
                        <>
                            <span className="text-red-500">Error</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden md:inline text-emerald-500">Synced</span>
                        </>
                    )}
                </div>


                {/* Profile Button */}
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center justify-center p-2.5 border-[3px] border-black bg-white hover:bg-slate-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-px hover:-translate-y-px transition-all ml-2"
                    title={user?.username || 'Profile'}
                >
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
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
