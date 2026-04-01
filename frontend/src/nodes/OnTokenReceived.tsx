import { BaseNode } from "./BaseNode";
import { StandardInput, VariableAssignField } from "../components/Fields";
import { useFlow } from "../context/FlowContext";
import { Position } from "@xyflow/react";

const TokenIcon = () => (
    <svg className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
    </svg>
);

const TokenSetupFields = ({ data, onFieldChange, errors }: any) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <StandardInput
            label="Token Address Variable"
            helper="The token address will be filter"
            value={data.tokenAddressVar || ''}
            onChange={(val) => onFieldChange("tokenAddressVar", val.target.value)}
            error={errors?.tokenAddressVar}
        />

        <VariableAssignField
            label="Amount Variable"
            value={data.assignedVariable || ''}
            onChange={(val) => onFieldChange('assignedVariable', val)}
            error={errors?.assignedVariable}
            helper="The received amount will be stored in this variable (e.g. 'amount')."
        />

        <VariableAssignField
            label="Sender Variable"
            value={data.assignedSender || ''}
            onChange={(val) => onFieldChange('assignedSender', val)}
            error={errors?.assignedSender}
            helper="The sender address will be stored in this variable (e.g. 'sender')."
        />

    </div>
);

export function OnTokenReceivedNode({ id, data, type }: any) {
    const { renameVariable } = useFlow();

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="Token Received"
            subtitle="Trigger"
            colorScheme="emerald"
            icon={<TokenIcon />}
            modalTitle="Token Monitor Setup"
            modalBody={(draft, update, errors) => (
                <TokenSetupFields
                    data={draft}
                    errors={errors}
                    onFieldChange={(field: string, val: string) => {
                        const currentDraftVal = draft[field];
                        if (currentDraftVal && currentDraftVal !== val) {
                            renameVariable(currentDraftVal, val);
                        }
                        update({ ...draft, [field]: val });
                    }}
                />
            )}
            customHandles={[
                {
                    id: 'sol',
                    position: Position.Bottom,
                    type: 'source',
                }
            ]}
        />
    );
}

export function OnTokenReceived(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="Token Received"
            subtitle="Trigger"
            colorScheme="emerald"
            icon={<TokenIcon />}
            isSidebar={true}
        />
    );
}