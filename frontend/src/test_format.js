export const formatLuaValue = (data: any, defaultValue: string = '""') => {
    if (!data) return defaultValue;
    if (data.mode === 'variable') {
        const varName = (data.value || '').trim();
        return varName !== '' ? varName : defaultValue;
    }

    const val = data.value || '';
    if (val === '') return '""';

    // Handle interpolation {{variable}}
    if (val.includes('{{') && val.includes('}}')) {
        const parts = val.split(/(\{\{.*?\}\})/g);
        const luaParts = parts.filter((p: string) => p !== "").map((p: string) => {
            if (p.startsWith('{{') && p.endsWith('}}')) {
                const varName = p.slice(2, -2).trim();
                return `tostring(${varName} or "")`;
            }
            return `"${p.replace(/"/g, '\\"')}"`;
        });
        return luaParts.join(' .. ');
    }

    if (val === 'true' || val === 'false') return val;
    const isDecimal = /^-?\d+(\.\d+)?$/.test(val);
    if (isDecimal) return val;
    return `"${val}"`;
};
console.log(formatLuaValue({ mode: 'variable', value: 'cron_sol_balance' }, '0'));
