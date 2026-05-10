# Guide: Adding New Nodes to Panon

Panon uses a **Dynamic Node Registry** system. All aspects of a node—UI, validation, and code generation—are defined in a single configuration file.

## Key Files
- **Registry**: `frontend/src/utils/nodeRegistry.tsx` (Add your node here)
- **Base UI**: `frontend/src/nodes/BaseNode.tsx` (Handles rendering/handles)
- **Fields**: `frontend/src/components/Fields.tsx` (Reusable UI components for setup modals)

---

## Step-by-Step: Adding a New Node

### 1. Define Your Node in `nodeRegistry.tsx`
Add a new key to the `nodeRegistry` object. The key must match the `type` string used in the flow.

```tsx
export const nodeRegistry: Record<string, NodeDef> = {
    // ... existing nodes
    YourNewNode: {
        title: "Your Node Name",
        subtitle: "Short Category", // e.g., "Action", "Compute", "Logic"
        category: "Action", // One of: 'Trigger', 'Action', 'Logic', 'Compute'
        icon: <YourIconComponent />,
        colorScheme: "emerald", // one of: 'indigo' | 'blue' | 'orange' | 'emerald' | 'rose' | 'purple'
        
        // Define ports (handles)
        customHandles: [
            { id: 'in', type: 'target', position: Position.Top },
            { id: 'out', type: 'source', position: Position.Bottom }
        ],

        // 1. Validation Logic
        validate: (node, nodes) => {
            const errors: Record<string, string> = {};
            if (!node.data.myField) errors.myField = "Field is required";
            return Object.keys(errors).length > 0 ? errors : null;
        },

        // 2. Lua Code Generation
        generate: (node, { getNext, indent }) => {
            const data = node.data;
            const nextCode = getNext(node.id);
            const core = `print("Node executed with value: " .. "${data.myField}")`;
            
            // withWrapper handles function wrapping (if used within branches)
            return withWrapper(node, core, nextCode, indent);
        },

        // 3. Setup UI (Modal)
        modalTitle: "Setup Your Node",
        modalBody: (draft, update, errors, nodeId, renameVariable) => (
            <div className="space-y-6">
                <StandardInput
                    label="My Setting"
                    value={draft.mySetting || ''}
                    onChange={(e) => update({ mySetting: e.target.value })}
                    error={errors?.mySetting}
                />
            </div>
        )
    }
};
```

### 2. Available Field Components
Found in `frontend/src/components/Fields.tsx`:

- **`VariableAssignField`**: Input field for creating a new variable name (includes `$` icon).
- **`VariableOrValueSelect`**: Toggle between entering a static value or selecting an existing variable.
- **`StandardInput`**: Basic text/number input with consistent styling.
- **`StandardSelect`**: Styled dropdown select.
- **`ConditionBuilder`**: Complex logic builder for `If` nodes.

### 3. Handle Variable Renaming
When using `VariableAssignField`, use the `handleVariableRename` helper to ensure references to the variable in other nodes are updated automatically:

```tsx
onChange={(val) => handleVariableRename('myVariableName', val, draft, update, renameVariable)}
```

---

## Automatic Integration
Once added to the registry:
1.  **Sidebar**: The node will automatically appear in the sidebar under its specified category.
2.  **Canvas**: React Flow will use the `DynamicNode` component to render it correctly.
3.  **Compiler**: The `compileToLua` function will automatically use your `generate` logic.

No further steps required!
