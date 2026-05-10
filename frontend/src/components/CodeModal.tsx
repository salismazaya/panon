import Modal from 'react-modal';

interface CodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    code: string;
}

export const CodeModal = ({ isOpen, onClose, code }: CodeModalProps) => {
    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        alert('Code copied to clipboard!');
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel="Generated Lua Code"
            closeTimeoutMS={300}
        >
            <div className="flex flex-col flex-1 min-h-0 bg-white selection:bg-black/10">
                <div className="px-8 py-6 border-b-4 border-black flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Generated Lua Script</h2>
                        <p className="text-[10px] text-black font-black uppercase tracking-[0.2em] opacity-40 mt-1">Ready for deployment</p>
                    </div>
                    <button onClick={onClose} className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8 grow overflow-auto bg-slate-50 border-3 border-black m-6 shadow-[4px_4px_0px_0px_#000]">
                    <pre className="font-mono text-sm leading-relaxed text-slate-800 whitespace-pre">
                        {code}
                    </pre>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t-4 border-black flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 border-2 border-black font-black text-xs uppercase hover:bg-black hover:text-white transition-all">
                        Close
                    </button>
                    <button 
                        onClick={copyToClipboard}
                        className="px-8 py-3 border-4 border-black font-black text-sm uppercase bg-[#818cf8] shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all"
                    >
                        Copy Code
                    </button>
                </div>
            </div>
        </Modal>
    );
};
