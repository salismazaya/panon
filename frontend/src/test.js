const formatLuaValue = (data, defaultValue = '""') => {
    if (!data) return defaultValue;
    if (data.mode === 'variable') {
        const varName = (data.value || '').trim();
        return varName !== '' ? varName : defaultValue;
    }

    const val = data.value || '';
    if (val === '') return '""';

    if (val === 'true' || val === 'false') return val;
    const isDecimal = /^-?\d+(\.\d+)?$/.test(val);
    if (isDecimal) return val;
    return `"${val}"`;
};

console.log(formatLuaValue({ mode: 'variable', value: 'cron_sol_balance' }, '0'));
console.log(formatLuaValue(undefined, '0'));
