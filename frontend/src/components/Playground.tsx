import { Background, ReactFlow } from "@xyflow/react";
import { DynamicNode } from "../components/DynamicNode";
import { nodeRegistry } from "../utils/nodeRegistry";
import { useFlow } from "../context/FlowContext";
import { useEffect } from "react";
import '@xyflow/react/dist/style.css';

const nodeTypes = Object.keys(nodeRegistry).reduce((acc, type) => {
    acc[type] = (props: any) => <DynamicNode {...props} type={type} />;
    return acc;
}, {} as any);

export default function Playground() {
    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, loadFlow } = useFlow();

    useEffect(() => {
        loadFlow();
    }, [loadFlow]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes} 
            fitView
        >
            <Background />
        </ReactFlow>
    );
}
