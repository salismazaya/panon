import React from 'react';
import { VariableAssignField, VariableOrValueSelect, FieldGroup, StandardSelect } from '../../components/Fields';
import { type NodeDef, isValidVariableName, formatLuaValue, withWrapper } from './types';
import { ComputeIcon } from './icons';

export const compute: Record<string, NodeDef> = {
    Compute: {
        title: "Arithmetic",
        subtitle: "Compute",
        category: "Compute",
        icon: <ComputeIcon />,
        colorScheme: "purple",
        modalTitle: "Setup Computation",
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

            if (!assignedVariable?.trim()) {
                errors.assignedVariable = "Destination variable is required";
            } else {
                const aError = isValidVariableName(assignedVariable.trim());
                if (aError) errors.assignedVariable = aError;
            }

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
        },
        modalBody: (draft, update, errors, nodeId) => (
            <div className="space-y-6">
                <FieldGroup label="Operation" helper="Result = Value 1 [Operator] Value 2" error={errors?.op1Data || errors?.op2Data || errors?.operator}>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <VariableOrValueSelect
                                label="Value 1"
                                data={draft.op1Data || { mode: 'variable', value: '' }}
                                onChange={(val: any) => update({ op1Data: val })}
                                error={errors?.op1Data}
                                nodeId={nodeId}
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
                                onChange={(val: any) => update({ op2Data: val })}
                                error={errors?.op2Data}
                                nodeId={nodeId}
                            />
                        </div>
                    </div>
                </FieldGroup>

                <VariableAssignField
                    label="Store Result To"
                    value={draft.assignedVariable || ''}
                    onChange={(val: any) => update({ assignedVariable: val })}
                    error={errors?.assignedVariable}
                    helper="Name of the new variable to store the result (e.g. 'net_amount')."
                />
            </div>
        )
    }
};
