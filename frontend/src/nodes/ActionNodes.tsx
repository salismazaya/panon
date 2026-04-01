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

export function TransferTokenNode({ id, data, type }: any) {
    const { getAvailableVariables } = useFlow();
    const availableVars = getAvailableVariables();

    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="Transfer Token"
            subtitle="Action"
            colorScheme="indigo"
            icon={<SendIcon />}
            modalTitle="Transfer Token Setup"
            modalBody={(draft, update, errors) => (
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

export function TransferToken(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="Transfer Token"
            subtitle="Action"
            colorScheme="indigo"
            icon={<SendIcon />}
            isSidebar={true}
        />
    );
}
