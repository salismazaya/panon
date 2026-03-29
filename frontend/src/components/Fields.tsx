import React from 'react';
import { useFlow } from '../context/FlowContext';

interface FieldProps {
  label: string;
  helper?: string;
  children: React.ReactNode;
}

export const FieldGroup = ({ label, helper, children }: FieldProps) => (
  <div className="space-y-2">
    <label className="text-[12px] font-black text-black uppercase tracking-widest">{label}</label>
    {children}
    {helper && <p className="text-[10px] text-black font-bold uppercase opacity-60 leading-tight">{helper}</p>}
  </div>
);

export const StandardInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full bg-white border-3 border-black px-4 py-3 text-sm font-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] focus:translate-x-[-2px] focus:translate-y-[-2px] transition-all placeholder:text-black/30 text-black ${props.className || ''}`}
  />
);

export const StandardSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      {...props}
      className={`w-full bg-white border-3 border-black px-4 py-3 text-sm font-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] focus:translate-x-[-2px] focus:translate-y-[-2px] transition-all text-black appearance-none cursor-pointer ${props.className || ''}`}
    />
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

export const VariableAssignField = ({
  value,
  onChange,
  label = "Assign to Variable",
  helper = "The received value will be stored in this variable name for later use."
}: {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  helper?: string;
}) => (
  <FieldGroup label={label} helper={helper}>
    <div className="relative">
      <StandardInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. income_amount"
        className="font-black pl-10"
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-lg">$</div>
    </div>
  </FieldGroup>
);

export const ConditionBuilder = ({
  data,
  onChange
}: {
  data: { variable?: string; operator?: string; comparisonData?: any };
  onChange: (newData: any) => void;
}) => {
  const { getAvailableVariables } = useFlow();
  const vars = getAvailableVariables();

  return (
    <FieldGroup label="Logic Condition" helper="Choose a variable to compare against a value.">
      <div className="flex flex-col gap-4">
        <StandardSelect
          value={data.variable || ''}
          onChange={(e) => onChange({ ...data, variable: e.target.value })}
        >
          <option value="" disabled>Select Variable...</option>
          {vars.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </StandardSelect>

        <div className="flex gap-4">
          <StandardSelect
            value={data.operator || '>'}
            onChange={(e) => onChange({ ...data, operator: e.target.value })}
            className="w-[80px]"
          >
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="==">==</option>
            <option value="!=">!=</option>
          </StandardSelect>

          <div className="grow">
            <VariableOrValueSelect
              label="" // Hide label for compact view
              data={data.comparisonData || { mode: 'static', value: '' }}
              onChange={(val) => onChange({ ...data, comparisonData: val })}
            />
          </div>
        </div>
      </div>
    </FieldGroup>
  );
};

const getAutoParsedType = (val: string) => {
  if (val === 'true' || val === 'false') return 'bool';
  if (/^-?\d+(\.\d+)?$/.test(val)) return '123';
  return '"abc"';
};

export const VariableOrValueSelect = ({
  data,
  onChange,
  label
}: {
  data: { mode?: 'static' | 'variable'; value?: string };
  onChange: (newData: any) => void;
  label: string;
}) => {
  const { getAvailableVariables } = useFlow();
  const vars = getAvailableVariables();
  const mode = data.mode || 'static';

  return (
    <FieldGroup label={label} helper={`Choose between a fixed value or a dynamic variable.`}>
      <div className="flex flex-col gap-4">
        <div className="flex border-3 border-black p-1 bg-white">
          <button
            type="button"
            onClick={() => onChange({ ...data, mode: 'static' })}
            className={`grow py-2 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'static' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
          >
            Static Value
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...data, mode: 'variable' })}
            className={`grow py-2 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'variable' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
          >
            Variable Ref
          </button>
        </div>

        <div className="relative">
          {mode === 'static' ? (
            <>
              <StandardInput
                type="text"
                value={data.value || ''}
                onChange={(e) => onChange({ ...data, value: e.target.value })}
                placeholder="Enter Fixed Value..."
                className="pl-12"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 font-black text-xs uppercase tracking-tighter select-none">
                {getAutoParsedType(data.value || '')}
              </div>
            </>
          ) : (
            <>
              <StandardSelect
                value={data.value || ''}
                onChange={(e) => onChange({ ...data, value: e.target.value })}
                className="pl-10"
              >
                <option value="" disabled>Select Variable...</option>
                {vars.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </StandardSelect>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-lg select-none">$</div>
            </>
          )}
        </div>
      </div>
    </FieldGroup>
  );
};


