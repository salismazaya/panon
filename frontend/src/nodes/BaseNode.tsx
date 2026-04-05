import { Handle, Position } from "@xyflow/react";
import React, { useState } from "react";
import Modal from 'react-modal';
import { useFlow } from "../context/FlowContext";

// Set the root element for accessibility
if (typeof window !== 'undefined') {
    Modal.setAppElement('#root');
}

export interface BaseNodeProps {
    id: string;
    data: any;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    colorScheme?: 'indigo' | 'blue' | 'orange' | 'emerald' | 'rose' | 'purple';
    modalTitle?: string;
    modalBody?: (data: any, updateData: (newData: any) => void, errors: Record<string, string> | null) => React.ReactNode;
    onClick?: () => void;
    children?: React.ReactNode;
    isSidebar?: boolean;
    type?: string;
    customHandles?: {
        id: string;
        type: 'source' | 'target';
        position: Position;
        label?: string;
    }[];
}

const colorMap = {
    indigo: {
        accent: 'text-black',
        bg: 'bg-[#818cf8]', // Indigo 400
        border: 'border-black',
        button: 'bg-[#818cf8] text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#000]',
        handle: '!border-black !bg-white'
    },
    blue: {
        accent: 'text-black',
        bg: 'bg-[#38bdf8]', // Sky 400
        border: 'border-black',
        button: 'bg-[#38bdf8] text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#000]',
        handle: '!border-black !bg-white'
    },
    orange: {
        accent: 'text-black',
        bg: 'bg-[#fb923c]', // Orange 400
        border: 'border-black',
        button: 'bg-[#fb923c] text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#000]',
        handle: '!border-black !bg-white'
    },
    emerald: {
        accent: 'text-black',
        bg: 'bg-[#34d399]', // Emerald 400
        border: 'border-black',
        button: 'bg-[#34d399] text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#000]',
        handle: '!border-black !bg-white'
    },
    rose: {
        accent: 'text-black',
        bg: 'bg-[#f472b6]', // Pink 400
        border: 'border-black',
        button: 'bg-[#f472b6] text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#000]',
        handle: '!border-black !bg-white'
    },
    purple: {
        accent: 'text-black',
        bg: 'bg-[#c084fc]', // Purple 400
        border: 'border-black',
        button: 'bg-[#c084fc] text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#000]',
        handle: '!border-black !bg-white'
    }
};

export function BaseNode({
    id,
    data,
    icon,
    title,
    subtitle,
    colorScheme = 'indigo',
    modalTitle,
    modalBody,
    onClick,
    children,
    isSidebar,
    type,
    customHandles
}: BaseNodeProps) {
    const { updateNodeData, isNodeValid, getNodeErrors } = useFlow();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [draftData, setDraftData] = useState(data);
    const theme = colorMap[colorScheme];

    const isValid = type && !isSidebar ? isNodeValid({ id, data, type } as any) : true;
    const draftErrors = type && !isSidebar ? getNodeErrors({ id, data: draftData, type } as any) : null;

    // Ensure draftData stays in sync when modal opens
    const handleOpenModal = () => {
        setDraftData(data);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        updateNodeData(id, draftData);
        setIsModalOpen(false);
    };

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            handleOpenModal();
        }
    };

    return (
        <div className="relative group">
            {/* Handles */}
            {!isSidebar && (
                customHandles ? (
                    customHandles.map((h) => (
                        <React.Fragment key={h.id}>
                            <Handle
                                id={h.id}
                                type={h.type}
                                position={h.position}
                                className={`w-5! h-5! bg-[#facc15]! border-3! border-black! shadow-[2px_2px_0px_0px_#000] hover:scale-110 transition-all z-50`}
                            />
                            {h.label && (
                                <div
                                    className="absolute whitespace-nowrap text-[8px] font-black uppercase tracking-tighter text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                                    style={{
                                        top: h.position === Position.Top ? '-12px' : h.position === Position.Bottom ? 'calc(100% + 4px)' : '50%',
                                        left: h.position === Position.Left ? '-12px' : h.position === Position.Right ? 'calc(100% + 4px)' : '50%',
                                        transform: h.position === Position.Top || h.position === Position.Bottom ? 'translateX(-50%)' : 'translateY(-50%)',
                                        marginTop: h.position === Position.Bottom ? '4px' : '0',
                                        marginLeft: h.position === Position.Right ? '8px' : '0'
                                    }}
                                >
                                    {h.label}
                                </div>
                            )}
                        </React.Fragment>
                    ))
                ) : (
                    <>
                        <Handle
                            type="target"
                            position={Position.Top}
                            className={`w-5! h-5! bg-[#facc15]! border-3! border-black! shadow-[2px_2px_0px_0px_#000] hover:scale-110 transition-all`}
                        />
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            className={`w-5! h-5! bg-[#facc15]! border-3! border-black! shadow-[2px_2px_0px_0px_#000] hover:scale-110 transition-all`}
                        />
                    </>
                )
            )}

            {/* Node Container */}
            <div
                onClick={handleClick}
                className={`px-5 py-4 min-w-[220px] bg-white border-4 ${isValid ? 'border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' : 'border-red-600 shadow-[6px_6px_0px_0px_rgba(220,38,38,1)]'} relative transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] ${isValid ? 'hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]' : 'hover:shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]'} cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>

                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${theme.bg} flex items-center justify-center border-2 ${isValid ? 'border-black' : 'border-red-600'}`}>
                        {icon}
                    </div>
                    <div className="relative">
                        {!isValid && !isSidebar && (
                            <div className="absolute -top-6 -left-2 bg-red-600 text-white text-[8px] font-black px-1 py-0.5 border border-black shadow-[2px_2px_0px_0px_#000]">INCOMPLETE</div>
                        )}
                        <div className={`text-[10px] font-black uppercase tracking-wider text-black`}>
                            {subtitle}
                        </div>
                        <div className="text-sm font-black text-black">{title}</div>
                    </div>
                </div>

                {children}
            </div>



            {/* Setup Modal */}
            {modalBody && (
                <Modal
                    isOpen={isModalOpen}
                    onRequestClose={() => setIsModalOpen(false)}
                    contentLabel={modalTitle || "Setup Node"}
                    closeTimeoutMS={300}
                >
                    <div className="flex flex-col h-full bg-white selection:bg-black/10">
                        {/* Header */}
                        <div className="px-8 py-6 border-b-4 border-black flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-black">{modalTitle || "Setup Node"}</h2>
                                <p className={`text-[12px] font-black uppercase tracking-widest mt-1 text-black opacity-60`}>{subtitle}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 border-2 border-black hover:bg-black hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-6 grow overflow-y-auto text-black font-medium">
                            {modalBody && modalBody(
                                draftData, 
                                (newData) => setDraftData((prev: any) => ({ ...prev, ...newData })),
                                draftErrors
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 bg-slate-50 border-t-4 border-black flex items-center justify-end gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 border-2 border-black font-black text-sm uppercase hover:bg-black hover:text-white transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className={`px-8 py-3 border-4 border-black font-black text-sm uppercase shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all ${theme.bg}`}
                            >
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
