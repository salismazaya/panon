import React from 'react';
import { useFlow } from '../context/FlowContext';

interface FieldProps {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}

export const FieldGroup = ({ label, helper, error, children }: FieldProps) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center group">
      <label className="text-[12px] font-black text-black uppercase tracking-widest">{label}</label>
      {error && <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter animate-pulse">{error}</span>}
    </div>
    <div className={`transition-all ${error ? "ring-2 ring-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]" : ""}`}>
      {children}
    </div>
    {helper && !error && <p className="text-[10px] text-black font-bold uppercase opacity-60 leading-tight">{helper}</p>}
  </div>
);

export interface StandardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export interface StandardSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const RawInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  ({ error, className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      className={`w-full bg-white border-3 border-black px-4 py-3 text-sm font-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] focus:translate-x-[-2px] focus:translate-y-[-2px] transition-all placeholder:text-black/30 text-black ${error ? 'border-red-600' : ''} ${className || ''}`}
    />
  )
);

export const RawSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }>(
  ({ error, className, ...props }, ref) => (
    <div className="relative">
      <select
        {...props}
        ref={ref}
        className={`w-full bg-white border-3 border-black px-4 py-3 text-sm font-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] focus:translate-x-[-2px] focus:translate-y-[-2px] transition-all text-black appearance-none cursor-pointer ${error ? 'border-red-600' : ''} ${className || ''}`}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
);

export const StandardInput = ({ label = '', helper, error, className, ...props }: StandardInputProps) => (
  <FieldGroup label={label} helper={helper} error={error}>
    <RawInput {...props} error={error} className={className} />
  </FieldGroup>
);

export const StandardSelect = ({ label = '', helper, error, className, ...props }: StandardSelectProps) => (
  <FieldGroup label={label} helper={helper} error={error}>
    <RawSelect {...props} error={error} className={className} />
  </FieldGroup>
);

export const VariableAssignField = ({
  value,
  onChange,
  error,
  label = "Assign to Variable",
  helper = "The received value will be stored in this variable name for later use."
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  label?: string;
  helper?: string;
}) => (
  <FieldGroup label={label} helper={helper} error={error}>
    <div className="relative">
      <RawInput
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder="Enter variable name"
        className="font-black pl-10"
        error={error}
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-lg">$</div>
    </div>
  </FieldGroup>
);

export const ConditionBuilder = ({
  data,
  onChange,
  errors,
  nodeId
}: {
  data: { variable?: string; operator?: string; comparisonData?: any };
  onChange: (newData: any) => void;
  errors?: Record<string, string> | null;
  nodeId?: string;
}) => {
  const { getAvailableVariables } = useFlow();
  const vars = getAvailableVariables(nodeId);

  return (
    <FieldGroup label="Logic Condition" helper="Choose a variable to compare against a value." error={errors?.variable || errors?.operator || errors?.comparisonData}>
      <div className="flex flex-col gap-4">
        <RawSelect
          value={data.variable || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...data, variable: e.target.value })}
          className={errors?.variable ? 'border-red-600' : ''}
          error={errors?.variable}
        >
          <option value="" disabled>Select Variable...</option>
          {vars.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </RawSelect>

        <div className="flex gap-4">
          <RawSelect
            value={data.operator || '>'}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...data, operator: e.target.value })}
            className={`w-[80px] ${errors?.operator ? 'border-red-600' : ''}`}
            error={errors?.operator}
          >
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="==">==</option>
            <option value="!=">!=</option>
          </RawSelect>

          <div className="grow">
            <VariableOrValueSelect
              label=""
              data={data.comparisonData || { mode: 'static', value: '' }}
              onChange={(val) => onChange({ ...data, comparisonData: val })}
              error={errors?.comparisonData}
              nodeId={nodeId}
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
  label,
  error,
  nodeId
}: {
  data: { mode?: 'static' | 'variable'; value?: string };
  onChange: (newData: any) => void;
  label: string;
  error?: string;
  nodeId?: string;
}) => {
  const { getAvailableVariables } = useFlow();
  const vars = getAvailableVariables(nodeId);
  const mode = data.mode || 'static';

  return (
    <FieldGroup label={label} helper={`Choose between a fixed value or a dynamic variable.`} error={error}>
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
            className={`growlabel="t" py-2 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'variable' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
          >
            Variable Ref
          </button>
        </div>

        <div className="relative">
          {mode === 'static' ? (
            <>
              <RawInput
                type="text"
                value={data.value || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...data, value: e.target.value })}
                placeholder="Enter Fixed Value..."
                className="pl-12"
                error={error}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 font-black text-xs uppercase tracking-tighter select-none">
                {getAutoParsedType(data.value || '')}
              </div>
            </>
          ) : (
            <>
              <RawSelect
                value={data.value || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...data, value: e.target.value })}
                className="pl-10"
                error={error}
              >
                <option value="" disabled>Select Variable...</option>
                {vars.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </RawSelect>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-lg select-none">$</div>
            </>
          )}
        </div>
      </div>
    </FieldGroup>
  );
};


