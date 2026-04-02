import type { Node, Edge } from '@xyflow/react';
import { nodeRegistry } from './nodeRegistry';

export function compileToLua(nodes: Node[], edges: Edge[]) {
    const indent = (code: string) => {
        if (!code) return '';
        return code.split('\n').map(line => '  ' + line).join('\n');
    };

    const getNext = (nodeId: string, handleId?: string): string => {
        const edge = edges.find(e =>
            e.source === nodeId &&
            (handleId ? e.sourceHandle === handleId : true)
        );

        if (!edge) return '';
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!targetNode) return '';

        const nodeDef = nodeRegistry[targetNode.type || ''];
        if (!nodeDef) return `-- Unknown node type: ${targetNode.type}`;

        return nodeDef.generate(targetNode, { getNext, indent, nodes });
    };

    const triggerTypes = ['OnTokenReceived', 'OnSolReceived', 'OnUSDCReceived'];
    const triggers = nodes.filter(n => triggerTypes.includes(n.type || ''));

    if (triggers.length === 0) {
        return '-- No trigger nodes found to start the flow.';
    }

    return triggers.map(trigger => {
        const nodeDef = nodeRegistry[trigger.type || ''];
        return nodeDef.generate(trigger, { getNext, indent, nodes });
    }).join('\n\n');
}
