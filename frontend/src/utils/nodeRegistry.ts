import type { Node } from '@xyflow/react';

export type LuaGenerator = (node: Node, context: {
    getNext: (nodeId: string, handleId?: string) => string;
    indent: (code: string) => string;
    nodes: Node[];
}) => string;

export interface NodeDef {
    generate: LuaGenerator;
    validate: (node: Node, nodes: Node[]) => boolean;
}

const isUnique = (nodeId: string, name: string, nodes: Node[]) => {
    if (!name || name.trim() === '') return true;
    const cleanName = name.trim();
    return !nodes.some(n =>
        n.id !== nodeId &&
        (n.data?.assignedVariable === cleanName || n.data?.assignedSender === cleanName)
    );
};

const withWrapper = (node: Node, code: string, nextCode: string, indent: (line: string) => string) => {
    const data = node.data as any;
    const wrapperName = data.functionWrapperName;
    if (wrapperName) {
        return `${wrapperName}(function()\n${indent(code)}\nend)${nextCode ? `\n${nextCode}` : ''}`;
    }
    return code + (nextCode ? `\n${nextCode}` : '');
};

const formatLuaValue = (data: any, defaultValue: string = '""') => {
    if (!data) return defaultValue;
    if (data.mode === 'variable') return data.value || defaultValue;

    const val = data.value || '';
    if (val === '') return '""';

    // Auto-parse booleans
    if (val === 'true' || val === 'false') return val;

    // Auto-parse numbers (strictly decimal/float to avoid mis-parsing hex addresses as huge numbers)
    const isDecimal = /^-?\d+(\.\d+)?$/.test(val);
    if (isDecimal) return val;

    // Everything else is a string (will be quoted)
    return `"${val}"`;
};

export const nodeRegistry: Record<string, NodeDef> = {
    OnUSDCReceived: {
        validate: (node, nodes) => {
            const data = node.data as any;
            const v1 = data.assignedVariable?.trim();
            const v2 = data.assignedSender?.trim();
            if (!v1 || !v2) return false;
            return isUnique(node.id, v1, nodes) && isUnique(node.id, v2, nodes) && v1 !== v2;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = data.customName || 'on_usdc_received';
            const amountVar = data.assignedVariable || 'amount';
            const senderVar = data.assignedSender || 'sender';
            const body = getNext(node.id);

            const core = `function ${fnName}(${amountVar}, ${senderVar})\n${indent(body || '-- no actions')}\nend`;

            return withWrapper(node, core, '', indent);
        }
    },

    OnSolReceived: {
        validate: (node, nodes) => {
            const data = node.data as any;
            const v1 = data.assignedVariable?.trim();
            const v2 = data.assignedSender?.trim();
            if (!v1 || !v2) return false;
            return isUnique(node.id, v1, nodes) && isUnique(node.id, v2, nodes) && v1 !== v2;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = data.customName || 'on_sol_received';
            const amountVar = data.assignedVariable || 'amount';
            const senderVar = data.assignedSender || 'sender';
            const body = getNext(node.id);

            const core = `function ${fnName}(${amountVar}, ${senderVar})\n${indent(body || '-- no actions')}\nend`;

            return withWrapper(node, core, '', indent);
        }
    },

    If: {
        validate: (node) => {
            const data = node.data as any;
            const { variable, operator, comparisonData } = data || {};
            // Default operator to '>' if not set
            const effectiveOp = operator || '>';
            if (!variable || effectiveOp === '?' || effectiveOp.trim() === '') return false;

            const val = comparisonData?.value;
            if (comparisonData?.mode === 'variable') return !!val;
            return val !== undefined && val !== null && val.toString().trim().length > 0;
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

            if (falseBranch) {
                core += `\nelse\n${indent(falseBranch)}`;
            }

            core += '\nend';

            return withWrapper(node, core, '', indent);
        }
    },

    Loop: {
        validate: (node) => {
            const data = node.data as any;
            return !!data.iterations && parseInt(data.iterations) >= 0;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const iterations = data.iterations || 5;
            const loopBody = getNext(node.id, 'loop');
            const nextPart = getNext(node.id, 'out');

            const core = `for i=1, ${iterations} do\n${indent(loopBody || '-- empty loop')}\nend`;

            return withWrapper(node, core, nextPart, indent);
        }
    },

    Transfer: {
        validate: (node) => {
            const data = node.data as any;
            const rData = data.recipientData;
            const aData = data.amountData;

            if (!rData) return false;
            const recipientValid = rData.mode === 'variable'
                ? !!rData.value?.trim()
                : !!rData.value?.trim();

            if (!recipientValid) return false;
            if (!aData) return false;

            const amountValid = aData.mode === 'variable'
                ? !!aData.value?.trim()
                : (aData.value !== undefined && aData.value !== null && aData.value.toString().trim() !== '');

            return amountValid;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = 'transfer';
            const recipient = formatLuaValue(data.recipientData, '"0x..."');
            const amount = formatLuaValue(data.amountData, '0');
            const token = `"${data.token || 'SOL'}"`;

            const core = `${fnName}(${recipient}, ${token}, ${amount})`;
            const nextPart = getNext(node.id);

            return withWrapper(node, core, nextPart, indent);
        }
    },

    GetSolBalance: {
        validate: (node) => {
            const data = node.data as any;
            const { balanceAmount } = data || {};
            return !!balanceAmount?.trim();
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = 'getBalance';
            const varBalance = data.balanceAmount || 'balance';

            const core = `${varBalance} = ${fnName}(my_address)`;
            const nextPart = getNext(node.id);

            return withWrapper(node, core, nextPart, indent);
        }
    },

    Compute: {
        validate: (node) => {
            const data = node.data as any;
            const { op1Data, op2Data, assignedVariable } = data || {};

            const op1Valid = op1Data?.mode === 'variable' ? !!op1Data.value?.trim() : (op1Data?.value !== undefined && op1Data?.value !== null && op1Data.value.toString().trim() !== '');
            const op2Valid = op2Data?.mode === 'variable' ? !!op2Data.value?.trim() : (op2Data?.value !== undefined && op2Data?.value !== null && op2Data.value.toString().trim() !== '');

            // operator is optional, defaults to '+'
            return op1Valid && op2Valid && !!assignedVariable?.trim();
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const { op1Data, op2Data, operator, assignedVariable } = data || {};

            const v1 = formatLuaValue(op1Data, '0');
            const v2 = formatLuaValue(op2Data, '0');
            const op = operator || '+';
            const res = assignedVariable || 'result';

            const core = `local ${res} = ${v1} ${op} ${v2}`;
            const nextPart = getNext(node.id);

            return withWrapper(node, core, nextPart, indent);
        }
    }
};
