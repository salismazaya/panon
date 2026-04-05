import React from 'react';
import { VariableAssignField, VariableOrValueSelect, FieldGroup, StandardSelect } from '../../components/Fields';
import { type NodeDef, isValidVariableName, isUnique, withWrapper, formatLuaValue, handleVariableRename, isValidBase58 } from './types';
import { SendIcon, SolanaIcon } from './icons';

export const actions: Record<string, NodeDef> = {
    Transfer: {
        title: "Transfer Crypto",
        subtitle: "Action",
        category: "Action",
        icon: <SendIcon />,
        colorScheme: "blue",
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
                    onChange={(val: any) => update({ amountData: val })}
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
        colorScheme: "blue",
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
    }
};
