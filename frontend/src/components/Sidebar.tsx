import { If } from "../nodes/ControlNodes";
import { Transfer } from "../nodes/ActionNodes";
import { useFlow } from "../context/FlowContext";
import { OnSolReceived } from "../nodes/OnSolReceived";
import { Arithmetic } from "../nodes/ComputeNodes";
import { GetSolBalance } from "../nodes/GetSolBalance";

export default function Sidebar() {
    const { addNode } = useFlow();

    return (
        <div className="w-80 h-screen bg-white border-r-4 border-black p-8 flex flex-col gap-8 z-10 shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#818cf8] border-4 border-black flex items-center justify-center font-black text-2xl text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">P</div>
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-black uppercase">Panon</h1>
                    <p className="text-[10px] text-black font-black uppercase tracking-[0.2em] opacity-50">Builder v1.0</p>
                </div>
            </div>

            <div className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                {/* <OnUSDCReceived
                    data={{ label: "On USDC Received" }}
                    onClick={() => addNode('OnUSDCReceived', { label: "On USDC Received" })}
                /> */}
                <If
                    data={{ label: "If Condition" }}
                    onClick={() => addNode('If', { label: "If Condition" })}
                />
                {/* <Loop 
                    data={{ label: "Loop" }} 
                    onClick={() => addNode('Loop', { label: "Loop" })}
                /> */}

                <OnSolReceived
                    data={{ label: "On Solana Received" }}
                    onClick={() => addNode('OnSolReceived', { label: "On Solana Received" })}
                />

                <div className="mt-4 border-t-2 border-black pt-6">
                    <label className="text-[12px] font-black text-black uppercase tracking-widest mb-4 block">Actions Library</label>
                    <GetSolBalance 
                        data={{ label: "Get SOL Balance" }} 
                        onClick={() => addNode('GetSolBalance', { label: "Get SOL Balance" })} 
                    />
                    <Transfer
                        data={{ label: "Transfer" }}
                        onClick={() => addNode('Transfer', { label: "Transfer" })}
                    />
                    <Arithmetic
                        data={{ label: "Arithmetic" }}
                        onClick={() => addNode('Compute', { label: "Arithmetic" })}
                    />
                </div>
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