import { type NodeDef } from './types';
import { triggers } from './triggers';
import { actions } from './actions';
import { logic } from './logic';
import { compute } from './compute';

export * from './types';
export * from './icons';

export const nodeRegistry: Record<string, NodeDef> = {
    ...triggers,
    ...actions,
    ...logic,
    ...compute,
};
