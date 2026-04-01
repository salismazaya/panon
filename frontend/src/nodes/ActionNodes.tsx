import { BaseNode } from './BaseNode';
import { FieldGroup, StandardSelect, VariableOrValueSelect } from '../components/Fields';
import { useFlow } from '../context/FlowContext';

const SendIcon = () => (
    <svg className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13" />
        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
);

export function TransferNode({ id, data, type }: any) {
    const { getAvailableVariables } = useFlow();
    const availableVars = getAvailableVariables();

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="Transfer Crypto"
            subtitle="Action"
            colorScheme="blue"
            icon={<SendIcon />}
            modalTitle="Transfer Setup"
            modalBody={(draft, update, errors) => (
                <div className="space-y-6">
                    <FieldGroup label="Token" helper="The cryptocurrency to be sent.">
                        <StandardSelect
                            value={draft.token || 'SOL'}
                            onChange={(e) => update({ token: e.target.value })}
                        >
                            <option value="SOL">Solana (SOL)</option>
                        </StandardSelect>
                    </FieldGroup>

                    <VariableOrValueSelect
                        label="Recipient Address"
                        data={draft.recipientData || { mode: 'static', value: '' }}
                        onChange={(val) => update({ recipientData: val })}
                        error={errors?.recipientData}
                    />

                    <VariableOrValueSelect
                        label="Amount"
                        data={draft.amountData || (availableVars.length > 0
                            ? { mode: 'variable', value: availableVars[0] }
                            : { mode: 'static', value: '0' })}
                        onChange={(val) => update({ amountData: val })}
                        error={errors?.amountData}
                    />
                </div>
            )}
        />
    );
}

export function Transfer(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="Transfer Crypto"
            subtitle="Action"
            colorScheme="blue"
            icon={<SendIcon />}
            isSidebar={true}
        />
    );
}
