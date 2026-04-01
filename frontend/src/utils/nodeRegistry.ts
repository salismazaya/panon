import type { Node } from '@xyflow/react';

export type LuaGenerator = (node: Node, context: {
    getNext: (nodeId: string, handleId?: string) => string;
    indent: (code: string) => string;
    nodes: Node[];
}) => string;

export interface NodeDef {
    generate: LuaGenerator;
    validate: (node: Node, nodes: Node[]) => Record<string, string> | null;
}

const isUnique = (nodeId: string, name: string, nodes: Node[]) => {
    if (!name || name.trim() === '') return true;
    const cleanName = name.trim();
    return !nodes.some(n =>
        n.id !== nodeId &&
        (n.data?.assignedVariable === cleanName || n.data?.assignedSender === cleanName)
    );
};

// Base58 alphabet used in Solana addresses (no 0, O, I, L)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isValidBase58 = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    return BASE58_REGEX.test(value);
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
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const amountVar = data.assignedVariable?.trim();
            const senderVar = data.assignedSender?.trim();

            if (!amountVar) errors.assignedVariable = "Amount variable name is required";
            if (!senderVar) errors.assignedSender = "Sender variable name is required";

            if (amountVar && !isUnique(node.id, amountVar, nodes)) errors.assignedVariable = "Variable name must be unique";
            if (senderVar && !isUnique(node.id, senderVar, nodes)) errors.assignedSender = "Variable name must be unique";
            if (amountVar && senderVar && amountVar === senderVar) {
                errors.assignedVariable = "Variables must be different";
                errors.assignedSender = "Variables must be different";
            }

            return Object.keys(errors).length > 0 ? errors : null;
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
    OnTokenReceived: {
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const amountVar = data.assignedVariable?.trim();
            const senderVar = data.assignedSender?.trim();
            const tokenAddressVar = data.tokenAddressVar?.trim();

            if (!amountVar) errors.assignedVariable = "Amount variable name is required";
            if (!senderVar) errors.assignedSender = "Sender variable name is required";
            if (!tokenAddressVar) errors.tokenAddressVar = "Token address is required";

            if (amountVar && !isUnique(node.id, amountVar, nodes)) errors.assignedVariable = "Variable name must be unique";
            if (senderVar && !isUnique(node.id, senderVar, nodes)) errors.assignedSender = "Variable name must be unique";
            if (amountVar && senderVar && amountVar === senderVar) {
                errors.assignedVariable = "Variables must be different";
                errors.assignedSender = "Variables must be different";
            }

            if (tokenAddressVar && !isValidBase58(tokenAddressVar)) {
                errors.tokenAddressVar = "Token address must be a valid Solana base58 address";
            }

            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const amountVar = data.assignedVariable || 'amount';
            const senderVar = data.assignedSender || 'sender';
            const tokenAddressVar = data.tokenAddressVar || 'token';
            const fnName = data.customName || `on_token_${tokenAddressVar}_received`;

            const body = getNext(node.id);

            const core = `function ${fnName}(${amountVar}, ${senderVar})\n${indent(body || '-- no actions')}\nend`;

            return withWrapper(node, core, '', indent);
        }
    },

    OnSolReceived: {
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const v1 = data.assignedVariable?.trim();
            const v2 = data.assignedSender?.trim();

            if (!v1) errors.assignedVariable = "Amount variable name is required";
            if (!v2) errors.assignedSender = "Sender variable name is required";

            if (v1 && !isUnique(node.id, v1, nodes)) errors.assignedVariable = "Variable name must be unique";
            if (v2 && !isUnique(node.id, v2, nodes)) errors.assignedSender = "Variable name must be unique";

            if (v1 && v2 && v1 === v2) {
                errors.assignedVariable = "Variables must be different";
                errors.assignedSender = "Variables must be different";
            }

            return Object.keys(errors).length > 0 ? errors : null;
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
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const { variable, comparisonData } = data || {};

            if (!variable) errors.variable = "Target variable is required";

            const val = comparisonData?.value;
            if (comparisonData?.mode === 'variable') {
                if (!val) errors.comparisonData = "Comparison variable is required";
            } else {
                if (val === undefined || val === null || val.toString().trim().length === 0) {
                    errors.comparisonData = "Comparison value is required";
                }
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

            if (falseBranch) {
                core += `\nelse\n${indent(falseBranch)}`;
            }

            core += '\nend';

            return withWrapper(node, core, '', indent);
        }
    },

    Loop: {
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
        }
    },

    Transfer: {
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const rData = data.recipientData;
            const aData = data.amountData;

            if (!rData || !rData.value?.trim()) {
                errors.recipientData = "Recipient address is required";
            }

            if (!aData || (aData.mode === 'variable' ? !aData.value?.trim() : (aData.value === undefined || aData.value === null || aData.value.toString().trim() === ''))) {
                errors.amountData = "Transfer amount is required";
            }

            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = 'transferSol';
            const recipient = formatLuaValue(data.recipientData, '"0x..."');
            const amount = formatLuaValue(data.amountData, '0');

            const core = `${fnName}(${recipient}, ${amount})`;
            const nextPart = getNext(node.id);

            return withWrapper(node, core, nextPart, indent);
        }
    },

    TransferToken: {
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const rData = data.recipientData;
            const aData = data.amountData;
            const tAddress = data.tokenAddress;

            if (!tAddress || tAddress.trim() === '') {
                errors.tokenAddress = "Token address is required";
            } else if (!isValidBase58(tAddress)) {
                errors.tokenAddress = "Token address must be a valid Solana base58 address";
            }

            if (!rData || !rData.value?.trim()) {
                errors.recipientData = "Recipient address is required";
            }

            if (!aData || (aData.mode === 'variable' ? !aData.value?.trim() : (aData.value === undefined || aData.value === null || aData.value.toString().trim() === ''))) {
                errors.amountData = "Transfer amount is required";
            }

            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = 'transferToken';
            const recipient = formatLuaValue(data.recipientData, '"0x..."');
            const amount = formatLuaValue(data.amountData, '0');
            const token = `"${data.tokenAddress || ''}"`;

            const core = `${fnName}(${recipient}, ${token}, ${amount})`;
            const nextPart = getNext(node.id);

            return withWrapper(node, core, nextPart, indent);
        }
    },

    GetSolBalance: {
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const { balanceAmount } = data || {};
            if (!balanceAmount?.trim()) errors.balanceAmount = "Storage variable name is required";
            return Object.keys(errors).length > 0 ? errors : null;
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
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const { op1Data, op2Data, assignedVariable } = data || {};

            if (!op1Data || (op1Data.mode === 'variable' ? !op1Data.value?.trim() : (op1Data.value === undefined || op1Data.value === null || op1Data.value.toString().trim() === ''))) {
                errors.op1Data = "First operand is required";
            }

            if (!op2Data || (op2Data.mode === 'variable' ? !op2Data.value?.trim() : (op2Data.value === undefined || op2Data.value === null || op2Data.value.toString().trim() === ''))) {
                errors.op2Data = "Second operand is required";
            }

            if (!assignedVariable?.trim()) errors.assignedVariable = "Destination variable is required";

            return Object.keys(errors).length > 0 ? errors : null;
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
