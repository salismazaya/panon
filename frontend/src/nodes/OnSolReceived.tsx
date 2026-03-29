import { BaseNode } from "./BaseNode";
import { VariableAssignField } from "../components/Fields";
import { useFlow } from "../context/FlowContext";

const SolanaIcon = () => (
    <svg className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 12 16 16 12" />
        <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
);

const SolanaSetupFields = ({ data, onFieldChange }: any) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <VariableAssignField
            label="Amount Variable"
            value={data.assignedVariable || ''}
            onChange={(val) => onFieldChange('assignedVariable', val)}
            helper="The received amount will be stored in this variable (e.g. 'amount')."
        />

        <VariableAssignField
            label="Sender Variable"
            value={data.assignedSender || ''}
            onChange={(val) => onFieldChange('assignedSender', val)}
            helper="The sender address will be stored in this variable (e.g. 'sender')."
        />

    </div>
);

export function OnSolReceivedNode({ id, data, type }: any) {
    const { renameVariable } = useFlow();

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="Solana Received"
            subtitle="Trigger"
            colorScheme="blue"
            icon={<SolanaIcon />}
            modalTitle="Solana Monitor Setup"
            modalBody={(draft, update) => (
                <SolanaSetupFields 
                    data={draft} 
                    onFieldChange={(field: string, val: string) => {
                        const currentDraftVal = draft[field];
                        if (currentDraftVal && currentDraftVal !== val) {
                            renameVariable(currentDraftVal, val);
                        }
                        update({ ...draft, [field]: val });
                    }} 
                />
            )}
        />
    );
}

export function OnSolReceived(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="Solana Received"
            subtitle="Trigger"
            colorScheme="blue"
            icon={<SolanaIcon />}
            isSidebar={true}
        />
    );
}