import { useFlow } from "../context/FlowContext";
import { nodeRegistry } from "../utils/nodeRegistry";
import { SidebarDynamicNode } from "./DynamicNode";

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { addNode } = useFlow();

    // Group nodes by category
    const categories = ['Trigger', 'Action', 'Logic', 'Compute'] as const;
    
    return (
        <div className={`
            fixed lg:relative inset-y-0 left-0 z-40
            w-80 h-screen bg-white border-r-4 border-black p-8 
            flex flex-col gap-8 shrink-0 transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#818cf8] border-4 border-black flex items-center justify-center font-black text-2xl text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">P</div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter text-black uppercase">Panon</h1>
                        <p className="text-[10px] text-black font-black uppercase tracking-[0.2em] opacity-50">Builder v1.0</p>
                    </div>
                </div>
                {/* Close button for mobile */}
                <button
                    onClick={onClose}
                    className="lg:hidden p-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                {categories.map((cat, catIdx) => {
                    const nodes = Object.entries(nodeRegistry).filter(([_, def]) => def.category === cat);
                    if (nodes.length === 0) return null;

                    return (
                        <div key={cat} className={catIdx > 0 ? "mt-4 border-t-2 border-black pt-6" : ""}>
                            <label className="text-[12px] font-black text-black uppercase tracking-widest mb-4 block">
                                {cat}s Library
                            </label>
                            <div className="flex flex-col gap-4">
                                {nodes.map(([type, def]) => (
                                    <SidebarDynamicNode
                                        key={type}
                                        type={type}
                                        label={def.title}
                                        onClick={() => addNode(type, { label: def.title })}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-auto pt-6 border-t-2 border-black">
                <div className="p-5 bg-[#facc15] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-[12px] text-black font-black uppercase tracking-wider">Builder Tip</p>
                    <p className="text-sm text-black mt-2 leading-tight font-bold">Drag blocks to the grid. Each connection generates a Lua callback automatically.</p>
                </div>
            </div>
        </div>
    );
};