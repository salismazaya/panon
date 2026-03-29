import { useState, useCallback } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge, type NodeChange, type EdgeChange, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Salis 1' }, type: 'kasep' },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Kasep 2' } },
  { id: 'n3', position: { x: 0, y: 200 }, data: { label: 'Kasep 2' } },

];
const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];


function CustomNode(props: { data: { label: string } }) {
  return (
    <div className="bg-red-500">
      <div>{props.data.label}</div>
      <Handle type="source" position={Position.Top} />
      <Handle type="target" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  kasep: CustomNode,
};

export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);


  const onNodesChange = useCallback(
    (changes: NodeChange<{ id: string; position: { x: number; y: number; }; data: { label: string; }; }>[]) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<{ id: string; source: string; target: string; }>[]) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: any) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const addNode = useCallback(() => {
    const newNode = {
      id: `n${nodes.length + 1}`,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `Node ${nodes.length + 1}` },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length]);

  return (
    <div className="w-screen h-screen m-0 p-0">
      <button
        onClick={addNode}
        className="absolute top-4 left-4 z-10 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
      >
        Add Node
      </button>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="w-full h-full"
      />
      {/* <Background />
      <Controls /> */}
    </div>
  );
}