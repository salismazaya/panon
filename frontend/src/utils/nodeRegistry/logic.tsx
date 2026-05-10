import React from 'react';
import { Position } from '@xyflow/react';
import { ConditionBuilder, FieldGroup, StandardInput } from '../../components/Fields';
import { type NodeDef, withWrapper, formatLuaValue } from './types';
import { IfIcon, LoopIcon } from './icons';

export const logic: Record<string, NodeDef> = {
    If: {
        title: "If Condition",
        subtitle: "Logic",
        category: "Logic",
        icon: <IfIcon />,
        colorScheme: "orange",
        modalTitle: "Setup Logical Branch",
        customHandles: [
            { id: 'in', type: 'target', position: Position.Top },
            { id: 'true', type: 'source', position: Position.Bottom, label: 'True' },
            { id: 'false', type: 'source', position: Position.Right, label: 'False' },
        ],
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const { variable, comparisonData } = data || {};
            if (!variable) errors.variable = "Target variable is required";
            const val = comparisonData?.value;
            if (comparisonData?.mode === 'variable') {
                if (!val) errors.comparisonData = "Comparison variable is required";
            } else {
                if (val === undefined || val === null || val.toString().trim().length === 0) errors.comparisonData = "Comparison value is required";
            }
            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const { variable, operator, comparisonData } = data || {};
            const effectiveOp = operator || '>';
            const trueBranch = getNext(node.id, 'true');
            const falseBranch = getNext(node.id, 'false');
            const val = formatLuaValue(comparisonData, 'true');

            let core = `if ${variable || 'true'} ${effectiveOp} ${val} then\n`;
            core += indent(trueBranch || '-- do nothing');
            if (falseBranch) core += `\nelse\n${indent(falseBranch)}`;
            core += '\nend';
            return withWrapper(node, core, '', indent);
        },
        modalBody: (draft, update, errors, nodeId) => (
            <ConditionBuilder data={draft} onChange={update} errors={errors} nodeId={nodeId} />
        )
    },

    Loop: {
        title: "Loop",
        subtitle: "Logic",
        category: "Logic",
        icon: <LoopIcon />,
        colorScheme: "emerald",
        modalTitle: "Setup Loop",
        customHandles: [
            { id: 'in', type: 'target', position: Position.Top },
            { id: 'loop', type: 'source', position: Position.Bottom, label: 'Body' },
            { id: 'out', type: 'source', position: Position.Right, label: 'Done' },
        ],
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            if (data.iterations === undefined || data.iterations === null || data.iterations.toString().trim() === '') {
                errors.iterations = "Number of iterations is required";
            } else if (parseInt(data.iterations) < 0) {
                errors.iterations = "Iterations must be non-negative";
            }
            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const iterations = data.iterations || 5;
            const loopBody = getNext(node.id, 'loop');
            const nextPart = getNext(node.id, 'out');
            const core = `for i=1, ${iterations} do\n${indent(loopBody || '-- empty loop')}\nend`;
            return withWrapper(node, core, nextPart, indent);
        },
        modalBody: (draft, update, errors) => (
            <FieldGroup
                label="Iterations"
                helper="How many times to repeat the body branch."
                error={errors?.iterations}
            >
                <StandardInput
                    type="number"
                    value={draft.iterations || 5}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ iterations: e.target.value })}
                    error={errors?.iterations}
                />
            </FieldGroup>
        )
    }
};
