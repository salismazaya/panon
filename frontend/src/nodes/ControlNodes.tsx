import { BaseNode } from "./BaseNode";
import { Position } from "@xyflow/react";
import { ConditionBuilder, FieldGroup, StandardInput } from "../components/Fields";

const IfIcon = () => (
    <svg className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 12l5 5 5-5-5-5-5 5z" />
        <path d="M12 17v4" />
        <path d="M12 3v4" />
    </svg>
);

const LoopIcon = () => (
    <svg className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);

export function IfNode({ id, data, type }: any) {
    const customHandles = [
        { id: 'in', type: 'target' as const, position: Position.Top },
        { id: 'true', type: 'source' as const, position: Position.Bottom, label: 'True' },
        { id: 'false', type: 'source' as const, position: Position.Right, label: 'False' },
    ];

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="If Condition"
            subtitle="Logic"
            colorScheme="orange"
            icon={<IfIcon />}
            modalTitle="Setup Logical Branch"
            modalBody={(draft, update) => (
                <ConditionBuilder data={draft} onChange={update} />
            )}
            customHandles={customHandles}
        />
    );
}

export function LoopNode({ id, data, type }: any) {
    const customHandles = [
        { id: 'in', type: 'target' as const, position: Position.Top },
        { id: 'loop', type: 'source' as const, position: Position.Bottom, label: 'Body' },
        { id: 'out', type: 'source' as const, position: Position.Right, label: 'Done' },
    ];

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="Loop"
            subtitle="Logic"
            colorScheme="emerald"
            icon={<LoopIcon />}
            modalTitle="Setup Loop"
            modalBody={(draft, update) => (
                <FieldGroup label="Iterations" helper="How many times to repeat the body branch.">
                    <StandardInput 
                        type="number"
                        value={draft.iterations || 5}
                        onChange={(e) => update({ iterations: e.target.value })}
                    />
                </FieldGroup>
            )}
            customHandles={customHandles}
        />
    );
}

// Sidebar Versions
export function If(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="If Condition"
            subtitle="Logic"
            colorScheme="orange"
            icon={<IfIcon />}
            isSidebar={true}
        />
    );
}

export function Loop(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="Loop"
            subtitle="Logic"
            colorScheme="emerald"
            icon={<LoopIcon />}
            isSidebar={true}
        />
    );
}
