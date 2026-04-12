import React from 'react';
import { VariableAssignField, VariableOrValueSelect, FieldGroup, StandardSelect, KeyValueField, StandardTextarea, StandardInput } from '../../components/Fields';
import { type NodeDef, isValidVariableName, isUnique, withWrapper, formatLuaValue, handleVariableRename, isValidBase58 } from './types';
import { SendIcon, SolanaIcon, GlobeIcon, DatabaseIcon } from './icons';

export const actions: Record<string, NodeDef> = {
    Transfer: {
        title: "Transfer Crypto",
        subtitle: "Action",
        category: "Action",
        icon: <SolanaIcon />,
        colorScheme: "white",
        modalTitle: "Transfer Setup",
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const rData = data.recipientData;
            const aData = data.amountData;

            if (!rData || !rData.value?.trim()) errors.recipientData = "Recipient address is required";
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
        },
        modalBody: (draft, update, errors, nodeId) => (
            <div className="space-y-6">
                <FieldGroup label="Token" helper="The cryptocurrency to be sent.">
                    <StandardSelect
                        value={draft.token || 'SOL'}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ token: e.target.value })}
                    >
                        <option value="SOL">Solana (SOL)</option>
                    </StandardSelect>
                </FieldGroup>

                <VariableOrValueSelect
                    label="Recipient Address"
                    data={draft.recipientData || { mode: 'static', value: '' }}
                    onChange={(val: any) => update({ recipientData: val })}
                    error={errors?.recipientData}
                    nodeId={nodeId}
                />

                <VariableOrValueSelect
                    label="Amount"
                    data={draft.amountData || { mode: 'static', value: '0' }}
                    onChange={(val: any) => update({ amountData: val })}
                    error={errors?.amountData}
                    nodeId={nodeId}
                />
            </div>
        )
    },

    TransferToken: {
        title: "Transfer Token",
        subtitle: "Action",
        category: "Action",
        icon: <SendIcon />,
        colorScheme: "indigo",
        modalTitle: "Transfer Token Setup",
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const rData = data.recipientData;
            const aData = data.amountData;
            const tAddress = data.tokenAddress;

            // console.log("Validating TransferToken node with data:", data);

            if (!tAddress || tAddress.trim() === '') {
                errors.tokenAddress = "Token address is required";
            } else if (!isValidBase58(tAddress)) {
                errors.tokenAddress = "Token address must be a valid Solana base58 address";
            }

            if (!rData || !rData.value?.trim()) errors.recipientData = "Recipient address is required";
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
        },
        modalBody: (draft, update, errors, nodeId) => (
            <div className="space-y-6">
                <FieldGroup label="Token Address" helper="The Mint Address of the SPL Token." error={errors?.tokenAddress}>
                    <input
                        type="text"
                        className={`w-full p-2 border-2 ${errors?.tokenAddress ? 'border-red-500 bg-red-50' : 'border-black'} focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black placeholder-gray-400`}
                        placeholder="e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                        value={draft.tokenAddress || ''}
                        onChange={(e) => update({ tokenAddress: e.target.value })}
                    />
                </FieldGroup>

                <VariableOrValueSelect
                    label="Recipient Address"
                    data={draft.recipientData || { mode: 'static', value: '' }}
                    onChange={(val: any) => update({ recipientData: val })}
                    error={errors?.recipientData}
                    nodeId={nodeId}
                />

                <VariableOrValueSelect
                    label="Amount"
                    data={draft.amountData || { mode: 'static', value: '0' }}
                    onChange={(val) => update({ amountData: val })}
                    error={errors?.amountData}
                    nodeId={nodeId}
                />
            </div>
        )
    },

    GetSolBalance: {
        title: "Get SOL Balance",
        subtitle: "Action",
        category: "Action",
        icon: <SolanaIcon />,
        colorScheme: "white",
        modalTitle: "Get SOL Balance Setup",
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const { balanceAmount } = data || {};
            const bError = isValidVariableName(balanceAmount?.trim());
            if (bError) errors.balanceAmount = bError;
            if (!errors.balanceAmount && balanceAmount && !isUnique(node.id, balanceAmount, nodes)) errors.balanceAmount = "Variable name must be unique";
            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = 'getBalance';
            const varBalance = data.balanceAmount || 'balance';
            const core = `${varBalance} = ${fnName}(my_address)`;
            const nextPart = getNext(node.id);
            return withWrapper(node, core, nextPart, indent);
        },
        modalBody: (draft, update, errors, _, renameVariable) => (
            <div className="space-y-6">
                <VariableAssignField
                    label="Balance Variable"
                    value={draft.balanceAmount || ''}
                    onChange={(val: any) => handleVariableRename('balanceAmount', val, draft, update, renameVariable)}
                    error={errors?.balanceAmount}
                    helper="The balance will be stored in this variable (e.g. 'balance')."
                />
            </div>
        )
    },

    GetTokenBalance: {
        title: "Get Token Balance",
        subtitle: "Action",
        category: "Action",
        icon: <SendIcon />,
        colorScheme: "emerald",
        modalTitle: "Get Token Balance Setup",
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const tAddress = data.tokenAddress?.value;
            const bAmount = data.balanceAmount;

            if (!tAddress || tAddress.trim() === '') {
                errors.tokenAddress = "Token address is required";
            } else if (!isValidBase58(tAddress)) {
                errors.tokenAddress = "Token address must be a valid Solana base58 address";
            }

            const bError = isValidVariableName(bAmount?.trim());
            if (bError) errors.balanceAmount = bError;
            if (!errors.balanceAmount && bAmount && !isUnique(node.id, bAmount, nodes)) {
                errors.balanceAmount = "Variable name must be unique";
            }

            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const fnName = "getTokenBalance"
            const tokenAddress = formatLuaValue(data.tokenAddress)
            const varBalance = data.balanceAmount || 'token_balance';
            const userAddress = "my_address";
            const core = `local ${varBalance} = ${fnName}(${userAddress}, ${tokenAddress})`;
            const nextPart = getNext(node.id);
            return withWrapper(node, core, nextPart, indent);
        },
        modalBody: (draft, update, errors, nodeId, renameVariable) => (
            <div className="space-y-6">
                <VariableOrValueSelect
                    label="Token Address"
                    data={draft.tokenAddress || { mode: 'static', value: '' }}
                    onChange={(val: any) => update({ tokenAddress: val })}
                    error={errors?.tokenAddress}
                    nodeId={nodeId}
                />

                <VariableAssignField
                    label="Balance Variable"
                    value={draft.balanceAmount || ''}
                    onChange={(val: any) => handleVariableRename('balanceAmount', val, draft, update, renameVariable)}
                    error={errors?.balanceAmount}
                    helper="The token balance will be stored in this variable."
                />
            </div>
        )
    },

    HttpRequest: {
        title: "HTTP Request",
        subtitle: "Network",
        category: "Action",
        icon: <GlobeIcon />,
        colorScheme: "blue",
        modalTitle: "HTTP Request Setup",
        modalSize: "large",
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            if (!data.urlData?.value?.trim()) errors.urlData = "URL is required";

            const bError = isValidVariableName(data.bodyVariable?.trim());
            if (bError) errors.bodyVariable = bError;
            if (!errors.bodyVariable && data.bodyVariable && !isUnique(node.id, data.bodyVariable, nodes)) {
                errors.bodyVariable = "Variable name must be unique";
            }

            const sError = isValidVariableName(data.statusVariable?.trim());
            if (sError) errors.statusVariable = sError;
            if (!errors.statusVariable && data.statusVariable && !isUnique(node.id, data.statusVariable, nodes)) {
                errors.statusVariable = "Variable name must be unique";
            }
            if (data.bodyVariable === data.statusVariable) {
                errors.statusVariable = "Status variable must be different from body variable";
            }

            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const url = formatLuaValue(data.urlData, '"https://..."');
            const method = `"${data.method || 'GET'}"`;
            const payload = formatLuaValue({ mode: 'static', value: data.payload }, '""');

            // Generate headers table
            const headerRows = data.headers || [];
            const headerEntries = headerRows
                .filter((r: any) => r.key.trim() !== '')
                .map((r: any) => `["${r.key}"] = ${formatLuaValue(r.value)}`)
                .join(", ");
            const headers = `{ ${headerEntries} }`;

            const bodyVar = data.bodyVariable || 'http_body';
            const statusVar = data.statusVariable || 'http_status';

            const core = `local ${bodyVar}, ${statusVar} = httpRequest(${url}, ${method}, ${headers}, ${payload})`;
            const nextPart = getNext(node.id);
            return withWrapper(node, core, nextPart, indent);
        },
        modalBody: (draft, update, errors, nodeId, renameVariable) => (
            <div className="space-y-6">
                <StandardSelect
                    label="Method"
                    value={draft.method || 'GET'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ method: e.target.value })}
                >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                </StandardSelect>

                <VariableOrValueSelect
                    label="URL"
                    data={draft.urlData || { mode: 'static', value: '' }}
                    onChange={(val) => update({ urlData: val })}
                    error={errors?.urlData}
                    nodeId={nodeId}
                />

                <KeyValueField
                    label="Headers"
                    helper="Add custom HTTP headers (e.g. Content-Type, Authorization)."
                    data={draft.headers || []}
                    onChange={(val) => update({ headers: val })}
                    nodeId={nodeId}
                />

                <StandardTextarea
                    label="Payload"
                    helper="Request body (Standard text or use {{variable}} for injection)."
                    value={draft.payload || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update({ payload: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-4">
                    <VariableAssignField
                        label="Body Variable"
                        value={draft.bodyVariable || ''}
                        onChange={(val) => handleVariableRename('bodyVariable', val, draft, update, renameVariable)}
                        error={errors?.bodyVariable}
                        helper="Stores response body."
                    />
                    <VariableAssignField
                        label="Status Variable"
                        value={draft.statusVariable || ''}
                        onChange={(val) => handleVariableRename('statusVariable', val, draft, update, renameVariable)}
                        error={errors?.statusVariable}
                        helper="Stores status code."
                    />
                </div>
            </div>
        )
    },

    StoreMemory: {
        title: "Store Memory",
        subtitle: "Database",
        category: "Action",
        icon: <DatabaseIcon />,
        colorScheme: "emerald",
        modalTitle: "Store Data",
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            if (!data.name?.trim()) errors.name = "Key name is required";
            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const name = formatLuaValue({ mode: 'static', value: data.name }, '""');
            const value = formatLuaValue({ mode: 'static', value: data.value }, '""');

            const core = `setMemory(${name}, ${value})`;
            return withWrapper(node, core, getNext(node.id), indent);
        },
        modalBody: (draft, update, errors) => (
            <div className="space-y-6">
                <StandardInput
                    label="Memory Name (Key)"
                    helper="The unique identifier for this data (e.g. 'last_user')."
                    value={draft.name || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ name: e.target.value })}
                    error={errors?.name}
                />
                <StandardTextarea
                    label="Value to Store"
                    helper="Supports {{variable}} injection."
                    value={draft.value || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update({ value: e.target.value })}
                />
            </div>
        )
    },

    GetMemory: {
        title: "Get Memory",
        subtitle: "Database",
        category: "Action",
        icon: <DatabaseIcon />,
        colorScheme: "emerald",
        modalTitle: "Retrieve Data",
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            if (!data.name?.trim()) errors.name = "Key name is required";
            const vError = isValidVariableName(data.assignedVariable?.trim());
            if (vError) errors.assignedVariable = vError;
            if (!errors.assignedVariable && data.assignedVariable && !isUnique(node.id, data.assignedVariable, nodes)) {
                errors.assignedVariable = "Variable name must be unique";
            }
            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const name = formatLuaValue({ mode: 'static', value: data.name }, '""');
            const variable = data.assignedVariable || 'mem_val';

            const core = `local ${variable} = getMemory(${name})`;
            return withWrapper(node, core, getNext(node.id), indent);
        },
        modalBody: (draft, update, errors, _, renameVariable) => (
            <div className="space-y-6">
                <StandardInput
                    label="Memory Name (Key)"
                    helper="The identifier to retrieve."
                    value={draft.name || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ name: e.target.value })}
                    error={errors?.name}
                />
                <VariableAssignField
                    label="Assign to Variable"
                    value={draft.assignedVariable || ''}
                    onChange={(val) => handleVariableRename('assignedVariable', val, draft, update, renameVariable)}
                    error={errors?.assignedVariable}
                    helper="Stores the retrieved value."
                />
            </div>
        )
    }
};
