import type { Node } from '@xyflow/react';
import { Position } from '@xyflow/react';
import React from 'react';

export type LuaGenerator = (node: Node, context: {
    getNext: (nodeId: string, handleId?: string) => string;
    indent: (code: string) => string;
    nodes: Node[];
}) => string;

export interface NodeDef {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    colorScheme: 'indigo' | 'blue' | 'orange' | 'emerald' | 'rose' | 'purple';
    category: 'Trigger' | 'Action' | 'Logic' | 'Compute';
    modalTitle?: string;
    initialData?: any;
    customHandles?: {
        id: string;
        type: 'source' | 'target';
        position: Position;
        label?: string;
    }[];
    generate: LuaGenerator;
    validate: (node: Node, nodes: Node[]) => Record<string, string> | null;
    modalBody?: (
        draft: any,
        update: (newData: any) => void,
        errors: Record<string, string> | null,
        nodeId: string,
        renameVariable: (oldName: string, newName: string) => void
    ) => React.ReactNode;
}

export const isUnique = (nodeId: string, name: string, nodes: Node[]) => {
    if (!name || name.trim() === '') return true;
    const cleanName = name.trim();
    return !nodes.some(n =>
        n.id !== nodeId &&
        (n.data?.assignedVariable === cleanName || n.data?.assignedSender === cleanName || n.data?.balanceAmount === cleanName)
    );
};

export const isValidVariableName = (name: string): string | null => {
    if (!name || name.trim() === '') return "Variable name is required";
    if (/\s/.test(name)) return "Variable cannot contain spaces";
    if (/^\d/.test(name)) return "Variable cannot start with a number";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return "Variable can only contain letters, numbers, and underscores";
    return null;
};

export const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isValidBase58 = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    return BASE58_REGEX.test(value);
};

export const withWrapper = (node: Node, code: string, nextCode: string, indent: (line: string) => string) => {
    const data = node.data as any;
    const wrapperName = data.functionWrapperName;
    if (wrapperName) {
        return `${wrapperName}(function()\n${indent(code)}\nend)${nextCode ? `\n${nextCode}` : ''}`;
    }
    return code + (nextCode ? `\n${nextCode}` : '');
};

export const formatLuaValue = (data: any, defaultValue: string = '""') => {
    if (!data) return defaultValue;
    if (data.mode === 'variable') return data.value || defaultValue;

    const val = data.value || '';
    if (val === '') return '""';
    if (val === 'true' || val === 'false') return val;
    const isDecimal = /^-?\d+(\.\d+)?$/.test(val);
    if (isDecimal) return val;
    return `"${val}"`;
};

export const handleVariableRename = (field: string, val: string, draft: any, update: any, renameVariable: any) => {
    const currentDraftVal = draft[field];
    if (currentDraftVal && currentDraftVal !== val) {
        renameVariable(currentDraftVal, val);
    }
    update({ [field]: val });
};
