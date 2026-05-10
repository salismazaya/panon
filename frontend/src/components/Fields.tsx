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

export interface StandardTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const RawTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(
  ({ error, className, ...props }, ref) => (
    <textarea
      {...props}
      ref={ref}
      className={`w-full bg-white border-3 border-black px-4 py-3 text-sm font-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] focus:translate-x-[-2px] focus:translate-y-[-2px] transition-all placeholder:text-black/30 text-black min-h-[120px] resize-y ${error ? 'border-red-600' : ''} ${className || ''}`}
    />
  )
);

export const StandardTextarea = ({ label = '', helper, error, className, ...props }: StandardTextareaProps) => (
  <FieldGroup label={label} helper={helper} error={error}>
    <RawTextarea {...props} error={error} className={className} />
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
          value={vars.includes(data.variable || '') ? data.variable : ''}
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
  helper,
  error,
  nodeId
}: {
  data: { mode?: 'static' | 'variable'; value?: string };
  onChange: (newData: any) => void;
  label: string;
  helper?: string;
  error?: string;
  nodeId?: string;
}) => {
  const { getAvailableVariables } = useFlow();
  const vars = getAvailableVariables(nodeId);
  const mode = data.mode || 'static';

  return (
    <FieldGroup label={label} helper={helper || `Choose between a fixed value or a dynamic variable.`} error={error}>
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
            onClick={() => {
              let newValue = data.value;
              if (vars.length > 0 && (!data.value || !vars.includes(data.value))) {
                newValue = vars[0];
              }
              onChange({ ...data, mode: 'variable', value: newValue });
            }}
            className={`grow py-2 px-3 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'variable' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
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
                value={vars.includes(data.value || '') ? data.value : ''}
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



export const KeyValueField = ({
  label,
  helper,
  data = [],
  onChange,
  error,
  nodeId
}: {
  label: string;
  helper?: string;
  data: { key: string; value: { mode: 'static' | 'variable'; value: string } }[];
  onChange: (newData: any[]) => void;
  error?: string;
  nodeId?: string;
}) => {
  const addRow = () => {
    onChange([...data, { key: '', value: { mode: 'static', value: '' } }]);
  };

  const removeRow = (index: number) => {
    const newData = [...data];
    newData.splice(index, 1);
    onChange(newData);
  };

  const updateRow = (index: number, field: string, val: any) => {
    const newData = [...data];
    if (field === 'key') {
      newData[index].key = val;
    } else {
      newData[index].value = val;
    }
    onChange(newData);
  };

  return (
    <FieldGroup label={label} helper={helper} error={error}>
      <div className="space-y-4">
        {data.map((row, index) => (
          <div key={index} className="flex gap-4 items-start bg-black/5 p-4 border-2 border-dashed border-black">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black uppercase opacity-50">Key</label>
              <RawInput
                placeholder="e.g. Content-Type"
                value={row.key}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRow(index, 'key', e.target.value)}
              />
            </div>
            <div className="flex-[1.5] space-y-2">
              <label className="text-[10px] font-black uppercase opacity-50">Value</label>
              <VariableOrValueSelect
                label=""
                data={row.value || { mode: 'static', value: '' }}
                onChange={(val) => updateRow(index, 'value', val)}
                nodeId={nodeId}
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="mt-8 bg-red-600 text-white p-2 border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="w-full py-3 bg-white border-3 border-black text-xs font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4" />
          </svg>
          Add Header
        </button>
      </div>
    </FieldGroup>
  );
};
