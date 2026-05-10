import { BaseNode } from '../nodes/BaseNode';
import { nodeRegistry } from '../utils/nodeRegistry';
import { useFlow } from '../context/FlowContext';

export interface DynamicNodeProps {
    id: string;
    data: any;
    type: string;
    isSidebar?: boolean;
    onClick?: () => void;
}

export function DynamicNode({ id, data, type, isSidebar, onClick }: DynamicNodeProps) {
    const { renameVariable } = useFlow();
    const nodeDef = nodeRegistry[type];

    if (!nodeDef) {
        return (
            <div className="p-4 bg-red-100 border-2 border-red-500 text-red-700 font-bold">
                Unknown Node Type: {type}
            </div>
        );
    }

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title={nodeDef.title}
            subtitle={nodeDef.subtitle}
            icon={nodeDef.icon}
            colorScheme={nodeDef.colorScheme}
            modalTitle={nodeDef.modalTitle}
            customHandles={nodeDef.customHandles}
            isSidebar={isSidebar}
            onClick={onClick}
            modalBody={nodeDef.modalBody ? (draft, update, errors) => 
                nodeDef.modalBody!(draft, update, errors, id, renameVariable) 
            : undefined}
        />
    );
}

// Helper to create sidebar version
export function SidebarDynamicNode({ type, label, onClick }: { type: string, label: string, onClick: () => void }) {
    return (
        <DynamicNode 
            id="" 
            data={{ label }} 
            type={type} 
            isSidebar={true} 
            onClick={onClick} 
        />
    );
}
