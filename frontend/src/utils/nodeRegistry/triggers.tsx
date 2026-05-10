import React from 'react';
import { Position } from '@xyflow/react';
import { VariableAssignField, StandardInput, StandardSelect } from '../../components/Fields';
import { type NodeDef, isValidVariableName, isUnique, withWrapper, handleVariableRename, isValidBase58 } from './types';
import { SolanaIcon, USDCIcon, TokenIcon, ClockIcon } from './icons';

export const triggers: Record<string, NodeDef> = {
    OnCron: {
        title: "Cron Trigger",
        subtitle: "Trigger",
        category: "Trigger",
        icon: <ClockIcon />,
        colorScheme: "rose",
        modalTitle: "Cron Trigger Setup",
        customHandles: [
            { id: 'cron', position: Position.Bottom, type: 'source' }
        ],
        validate: (node) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            if (!data.cronSpec?.trim()) {
                errors.cronSpec = "Cron expression is required";
            }
            return Object.keys(errors).length > 0 ? errors : null;
        },
        generate: (node, { getNext, indent }) => {
            const data = node.data as any;
            const spec = (data.cronSpec?.trim()) || '* * * * *';
            const fnName = `on_cron_${node.id.replace(/-/g, '_')}`;
            const body = getNext(node.id);
            const core = `-- cron: ${spec}\nfunction ${fnName}()\n${indent(body || '-- no actions')}\nend`;
            return withWrapper(node, core, '', indent);
        },
        modalBody: (draft, update, errors) => {
            const presets = [
                { label: "Every Second", value: "* * * * * *" },
                { label: "Every 10 Seconds", value: "*/10 * * * * *" },
                { label: "Every Minute", value: "* * * * *" },
                { label: "Every 5 Minutes", value: "*/5 * * * *" },
                { label: "Every Hour", value: "0 * * * *" },
                { label: "Every Day at Midnight", value: "0 0 * * *" },
                { label: "Every Week (Sunday)", value: "0 0 * * 0" },
                { label: "Custom Expression", value: "custom" }
            ];

            const isCustom = !presets.some(p => p.value === draft.cronSpec) && draft.cronSpec !== undefined;
            const selectedValue = isCustom ? "custom" : (draft.cronSpec || "* * * * *");

            return (
                <div className="space-y-6">
                    <StandardSelect
                        label="Interval Preset"
                        value={selectedValue}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const val = e.target.value;
                            if (val === "custom") {
                                // Add a trailing space to make it "custom" (not matching any preset)
                                update({ cronSpec: (draft.cronSpec || "* * * * *") + " " });
                            } else {
                                update({ cronSpec: val });
                            }
                        }}
                    >
                        {presets.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </StandardSelect>

                    {(selectedValue === "custom" || isCustom) && (
                        <StandardInput
                            label="Custom Cron Expression"
                            helper="Use standard cron format: minute hour day(month) month day(week). Supports 5 or 6 fields."
                            value={draft.cronSpec || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ cronSpec: e.target.value })}
                            error={errors?.cronSpec}
                        />
                    )}
                </div>
            );
        }
    },
    OnSolReceived: {
        title: "Solana Received",
        subtitle: "Trigger",
        category: "Trigger",
        icon: <SolanaIcon />,
        colorScheme: "white",
        modalTitle: "Solana Monitor Setup",
        customHandles: [
            { id: 'sol', position: Position.Bottom, type: 'source' }
        ],
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const v1 = data.assignedVariable?.trim();
            const v2 = data.assignedSender?.trim();

            const v1Error = isValidVariableName(v1);
            if (v1Error) errors.assignedVariable = v1Error;

            const v2Error = isValidVariableName(v2);
            if (v2Error) errors.assignedSender = v2Error;

            if (!errors.assignedVariable && v1 && !isUnique(node.id, v1, nodes)) errors.assignedVariable = "Variable name must be unique";
            if (!errors.assignedSender && v2 && !isUnique(node.id, v2, nodes)) errors.assignedSender = "Variable name must be unique";

            if (!errors.assignedVariable && !errors.assignedSender && v1 && v2 && v1 === v2) {
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
            const core = `function ${fnName}(${amountVar}, ${senderVar})\n` +
                indent(`local success = waitForTransaction(on_tx_hash)\nif success then\n${indent(`${body || '-- no actions'}`)}\nend`) +
                `\nend`;
            return withWrapper(node, core, '', indent);
        },
        modalBody: (draft, update, errors, _, renameVariable) => (
            <div className="space-y-6">
                <VariableAssignField
                    label="Amount Variable"
                    value={draft.assignedVariable || ''}
                    onChange={(val: any) => handleVariableRename('assignedVariable', val, draft, update, renameVariable)}
                    error={errors?.assignedVariable}
                    helper="The received amount will be stored in this variable (e.g. 'amount')."
                />
                <VariableAssignField
                    label="Sender Variable"
                    value={draft.assignedSender || ''}
                    onChange={(val: any) => handleVariableRename('assignedSender', val, draft, update, renameVariable)}
                    error={errors?.assignedSender}
                    helper="The sender address will be stored in this variable (e.g. 'sender')."
                />
            </div>
        )
    },

    OnUSDCReceived: {
        title: "USDC Received",
        subtitle: "Trigger",
        category: "Trigger",
        icon: <USDCIcon />,
        colorScheme: "indigo",
        modalTitle: "USDC Monitor Setup",
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const amountVar = data.assignedVariable?.trim();
            const senderVar = data.assignedSender?.trim();

            const amountError = isValidVariableName(amountVar);
            if (amountError) errors.assignedVariable = amountError;

            const senderError = isValidVariableName(senderVar);
            if (senderError) errors.assignedSender = senderError;

            if (!errors.assignedVariable && amountVar && !isUnique(node.id, amountVar, nodes)) errors.assignedVariable = "Variable name must be unique";
            if (!errors.assignedSender && senderVar && !isUnique(node.id, senderVar, nodes)) errors.assignedSender = "Variable name must be unique";

            if (!errors.assignedVariable && !errors.assignedSender && amountVar && senderVar && amountVar === senderVar) {
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
            const core = `function ${fnName}(${amountVar}, ${senderVar})\n` +
                indent(`local success = waitForTransaction(on_tx_hash)\nif success then\n${indent(`${body || '-- no actions'}`)}\nend`) +
                `\nend`;
            return withWrapper(node, core, '', indent);
        },
        modalBody: (draft, update, errors, _, renameVariable) => (
            <div className="space-y-6">
                <VariableAssignField
                    label="Amount Variable"
                    value={draft.assignedVariable || ''}
                    onChange={(val: any) => handleVariableRename('assignedVariable', val, draft, update, renameVariable)}
                    error={errors?.assignedVariable}
                    helper="The received amount will be stored in this variable (e.g. 'amount')."
                />
                <VariableAssignField
                    label="Sender Variable"
                    value={draft.assignedSender || ''}
                    onChange={(val: any) => handleVariableRename('assignedSender', val, draft, update, renameVariable)}
                    error={errors?.assignedSender}
                    helper="The sender address will be stored in this variable (e.g. 'sender')."
                />
            </div>
        )
    },

    OnTokenReceived: {
        title: "Token Received",
        subtitle: "Trigger",
        category: "Trigger",
        icon: <TokenIcon />,
        colorScheme: "emerald",
        modalTitle: "Token Monitor Setup",
        customHandles: [
            { id: 'sol', position: Position.Bottom, type: 'source' }
        ],
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            const data = node.data as any;
            const amountVar = data.assignedVariable?.trim();
            const senderVar = data.assignedSender?.trim();
            const tokenAddressVar = data.tokenAddressVar?.trim();

            const amountError = isValidVariableName(amountVar);
            if (amountError) errors.assignedVariable = amountError;

            const senderError = isValidVariableName(senderVar);
            if (senderError) errors.assignedSender = senderError;

            if (!tokenAddressVar) errors.tokenAddressVar = "Token address is required";
            if (tokenAddressVar && !isValidBase58(tokenAddressVar)) errors.tokenAddressVar = "Token address must be a valid Solana base58 address";

            if (!errors.assignedVariable && amountVar && !isUnique(node.id, amountVar, nodes)) errors.assignedVariable = "Variable name must be unique";
            if (!errors.assignedSender && senderVar && !isUnique(node.id, senderVar, nodes)) errors.assignedSender = "Variable name must be unique";

            if (!errors.assignedVariable && !errors.assignedSender && amountVar && senderVar && amountVar === senderVar) {
                errors.assignedVariable = "Variables must be different";
                errors.assignedSender = "Variables must be different";
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
            const core = `function ${fnName}(${amountVar}, ${senderVar})\n` +
                indent(`local success = waitForTransaction(on_tx_hash)\nif success then\n${indent(`${body || '-- no actions'}`)}\nend`) +
                `\nend`;
            return withWrapper(node, core, '', indent);
        },
        modalBody: (draft, update, errors, _, renameVariable) => (
            <div className="space-y-6">
                <StandardInput
                    label="Token Address"
                    helper="The SPL Token Mint address to monitor."
                    value={draft.tokenAddressVar || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ tokenAddressVar: e.target.value })}
                    error={errors?.tokenAddressVar}
                />
                <VariableAssignField
                    label="Amount Variable"
                    value={draft.assignedVariable || ''}
                    onChange={(val: any) => handleVariableRename('assignedVariable', val, draft, update, renameVariable)}
                    error={errors?.assignedVariable}
                    helper="The received amount will be stored in this variable."
                />
                <VariableAssignField
                    label="Sender Variable"
                    value={draft.assignedSender || ''}
                    onChange={(val: any) => handleVariableRename('assignedSender', val, draft, update, renameVariable)}
                    error={errors?.assignedSender}
                    helper="The sender address will be stored in this variable."
                />
            </div>
        )
    }
};
