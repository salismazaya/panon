import { Background, ReactFlow } from "@xyflow/react";
import { OnUSDCReceivedNode } from "../nodes/OnUSDCReceived";
import { IfNode, LoopNode } from "../nodes/ControlNodes";
import { TransferNode } from "../nodes/ActionNodes";
import '@xyflow/react/dist/style.css';
import { useFlow } from "../context/FlowContext";
import { OnSolReceivedNode } from "../nodes/OnSolReceived";
import { ArithmeticNode } from '../nodes/ComputeNodes';
import { useEffect } from "react";
import { GetSolBalanceNode } from "../nodes/GetSolBalance";
import { OnTokenReceivedNode } from "../nodes/OnTokenReceived";

const nodeTypes = {
    OnUSDCReceived: OnUSDCReceivedNode,
    If: IfNode,
    Loop: LoopNode,
    Transfer: TransferNode,
    Compute: ArithmeticNode,
    OnSolReceived: OnSolReceivedNode,
    GetSolBalance: GetSolBalanceNode,
    OnTokenReceived: OnTokenReceivedNode
};

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
            nodeTypes={nodeTypes} fitView>
            <Background />
        </ReactFlow>
    );
}
