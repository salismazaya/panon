import React from "react";
import { BaseNode } from "./BaseNode";
import { VariableOrValueSelect, StandardSelect, VariableAssignField, FieldGroup } from "../components/Fields";

const ComputeIcon = () => (
    <svg className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <circle cx="12" cy="6" r="1" />
    </svg>
);

export function ArithmeticNode({ id, data, type }: any) {
    return (
        <BaseNode
            id={id}
            data={data}
            type={type}
            title="Arithmetic"
            subtitle="Compute"
            colorScheme="purple"
            icon={<ComputeIcon />}
            modalTitle="Setup Computation"
            modalBody={(draft, update, errors) => (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <FieldGroup label="Operation" helper="Result = Value 1 [Operator] Value 2" error={errors?.op1Data || errors?.op2Data || errors?.operator}>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <VariableOrValueSelect
                                    label="Value 1"
                                    data={draft.op1Data || { mode: 'variable', value: '' }}
                                    onChange={(val) => update({ op1Data: val })}
                                    error={errors?.op1Data}
                                    nodeId={id}
                                />
                            </div>
                            <div className="w-20 pt-1">
                                <StandardSelect
                                    value={draft.operator || '+'}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ operator: e.target.value })}
                                >
                                    <option value="+">+</option>
                                    <option value="-">-</option>
                                    <option value="*">×</option>
                                    <option value="/">÷</option>
                                    <option value="%">%</option>
                                </StandardSelect>
                            </div>
                            <div className="flex-1 min-w-0">
                                <VariableOrValueSelect
                                    label="Value 2"
                                    data={draft.op2Data || { mode: 'variable', value: '' }}
                                    onChange={(val) => update({ op2Data: val })}
                                    error={errors?.op2Data}
                                    nodeId={id}
                                />
                            </div>
                        </div>
                    </FieldGroup>

                    <VariableAssignField
                        label="Store Result To"
                        value={draft.assignedVariable || ''}
                        onChange={(val) => update({ assignedVariable: val })}
                        error={errors?.assignedVariable}
                        helper="Name of the new variable to store the result (e.g. 'net_amount')."
                    />
                </div>
            )}
        />
    );
}

export function Arithmetic(props: any) {
    return (
        <BaseNode
            id=""
            data={{}}
            {...props}
            title="Arithmetic"
            subtitle="Compute"
            colorScheme="purple"
            icon={<ComputeIcon />}
            isSidebar={true}
        />
    );
}
