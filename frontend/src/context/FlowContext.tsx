import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { API_URL, authFetch } from '../utils/api';
import { nodeRegistry } from '../utils/nodeRegistry';
import { compileToLua } from '../utils/compiler';
import { useWorkspace } from './WorkspaceContext';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';

interface FlowContextType {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: string, data: any) => void;
  updateNodeData: (id: string, data: any) => void;
  getAvailableVariables: (nodeId?: string) => string[];
  getNodeErrors: (node: Node) => Record<string, string> | null;
  isNodeValid: (node: Node) => boolean;
  isFlowValid: () => boolean;
  isVariableNameUnique: (nodeId: string, name: string) => boolean;
  renameVariable: (oldName: string, newName: string) => void;
  loadFlow: () => Promise<void>;
  saveFlow: () => Promise<void>;
  isSaving: boolean;
  lastError: string | null;
}

const FlowContext = createContext<FlowContextType | null>(null);

export const FlowProvider = ({ children }: { children: ReactNode }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { currentWorkspace } = useWorkspace();
  const lastSavedRef = useRef<string>("");
  const isInitialLoad = useRef(true);
  const currentWorkspaceIdRef = useRef<number | null>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const addNode = useCallback((type: string, data: any) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data,
    };
    setNodes((nds) => nds.concat(newNode));
  }, []);

  const updateNodeData = useCallback((id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          // Merge existing data with new data
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, []);

  const getAvailableVariables = useCallback((nodeId?: string) => {
    const vars = new Set<string>();

    // Helper to find all predecessor nodes
    const getPredecessors = (id: string): Set<string> => {
      const preds = new Set<string>();
      const visited = new Set<string>();
      const stack = [id];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);

        edges.forEach(edge => {
          if (edge.target === current) {
            preds.add(edge.source);
            stack.push(edge.source);
          }
        });
      }
      return preds;
    };

    const allowedNodes = nodeId ? getPredecessors(nodeId) : null;

    nodes.forEach(n => {
      // If nodeId provided, only include variables from nodes that can reach it
      if (allowedNodes && !allowedNodes.has(n.id)) return;

      if (typeof n.data?.assignedVariable === 'string' && n.data.assignedVariable.trim()) vars.add(n.data.assignedVariable.trim());
      if (typeof n.data?.assignedSender === 'string' && n.data.assignedSender.trim()) vars.add(n.data.assignedSender.trim());
      if (typeof n.data?.balanceAmount === 'string' && n.data.balanceAmount.trim()) vars.add(n.data.balanceAmount.trim());
      if (typeof n.data?.bodyVariable === 'string' && n.data.bodyVariable.trim()) vars.add(n.data.bodyVariable.trim());
      if (typeof n.data?.statusVariable === 'string' && n.data.statusVariable.trim()) vars.add(n.data.statusVariable.trim());
    });

    return Array.from(vars);
  }, [nodes, edges]);

  const getNodeErrors = useCallback((node: Node) => {
    const nodeDef = nodeRegistry[node.type || ''];
    if (!nodeDef) return null;
    return nodeDef.validate(node, nodes);
  }, [nodes]);

  const isNodeValid = useCallback((node: Node) => {
    return getNodeErrors(node) === null;
  }, [getNodeErrors]);

  const isFlowValid = useCallback(() => {
    return nodes.length > 0 && nodes.every(node => isNodeValid(node));
  }, [nodes, isNodeValid]);

  const isVariableNameUnique = useCallback((nodeId: string, name: string) => {
    if (!name.trim()) return true;
    return !nodes.some(node =>
      node.id !== nodeId &&
      (
        node.data?.assignedVariable === name || 
        node.data?.assignedSender === name || 
        node.data?.balanceAmount === name ||
        node.data?.bodyVariable === name ||
        node.data?.statusVariable === name
      )
    );
  }, [nodes]);

  const renameVariable = useCallback((oldName: string, newName: string) => {
    if (!oldName.trim() || oldName === newName) return;

    setNodes(nds => nds.map(node => {
      const data = { ...node.data };
      let changed = false;

      // Scan common variable reference fields
      if (data.variable === oldName) {
        data.variable = newName;
        changed = true;
      }

      // Scan VariableOrValueSelect fields
      ['recipientData', 'amountData', 'comparisonData'].forEach(key => {
        const field = data[key] as any;
        if (field?.mode === 'variable' && field.value === oldName) {
          data[key] = { ...field, value: newName };
          changed = true;
        }
      });

      return changed ? { ...node, data } : node;
    }));
  }, []);

  const saveFlow = useCallback(async () => {
    if (!currentWorkspace) return;
    const currentHash = JSON.stringify({ nodes, edges });

    const isValid = nodes.length > 0 && nodes.every(node => isNodeValid(node));
    if (!isValid) return;

    setIsSaving(true);
    setLastError(null);

    try {
      const lua = compileToLua(nodes, edges);
      const response = await authFetch(`${API_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.workspaceId,
          code: lua,
          flow: { nodes, edges }
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        lastSavedRef.current = currentHash;
      } else {
        setLastError(result.error || 'Failed to save');
      }
    } catch (err) {
      setLastError('Connection error while saving');
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, isNodeValid, currentWorkspace]);

  const loadFlow = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const response = await authFetch(`${API_URL}/load?workspaceId=${currentWorkspace.workspaceId}`);
      const data = await response.json();

      if (data.status === 'not_found') {
        setNodes([]);
        setEdges([]);
        lastSavedRef.current = JSON.stringify({ nodes: [], edges: [] });
      } else if (data.flow) {
        setNodes(data.flow.nodes || []);
        setEdges(data.flow.edges || []);
        lastSavedRef.current = JSON.stringify({ nodes: data.flow.nodes, edges: data.flow.edges });
      }
      isInitialLoad.current = false;
    } catch (err) {
      console.error('Failed to load flow:', err);
      isInitialLoad.current = false;
    }
  }, [currentWorkspace]);

  // Handle Workspace Switch
  useEffect(() => {
    if (currentWorkspace?.workspaceId !== currentWorkspaceIdRef.current) {
      currentWorkspaceIdRef.current = currentWorkspace?.workspaceId || null;
      isInitialLoad.current = true; // Block autosave during load
      loadFlow();
    }
  }, [currentWorkspace, loadFlow]);

  // Autosave Effect
  useEffect(() => {
    if (isInitialLoad.current) return;

    const currentHash = JSON.stringify({ nodes, edges });
    if (currentHash === lastSavedRef.current) return;

    const debounceTimer = setTimeout(() => {
      saveFlow();
    }, 2000); // 2 second debounce

    return () => clearTimeout(debounceTimer);
  }, [nodes, edges, saveFlow]);

  return (
    <FlowContext.Provider
      value={{
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        updateNodeData,
        getAvailableVariables,
        getNodeErrors,
        isNodeValid,
        isFlowValid,
        isVariableNameUnique,
        renameVariable,
        loadFlow,
        saveFlow,
        isSaving,
        lastError,
      }}
    >
      {children}
    </FlowContext.Provider>
  );
};

export const useFlow = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return context;
};
