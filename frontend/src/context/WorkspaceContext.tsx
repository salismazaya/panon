import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { API_URL, authFetch } from '../utils/api';

export interface Workspace {
    workspaceId: number;
    walletId?: number;
    name: string;
    network: 'mainnet' | 'devnet';
    address?: string;
}

interface WorkspaceContextType {
    currentWorkspace: Workspace | null;
    workspaces: Workspace[];
    isLoading: boolean;
    selectWorkspace: (id: number) => Promise<void>;
    refreshWorkspaces: () => Promise<void>;
    createWorkspace: (name: string, network: 'mainnet' | 'devnet') => Promise<Workspace | null>;
    updateWorkspace: (id: number, name: string, network: 'mainnet' | 'devnet') => Promise<void>;
}


const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshWorkspaces = useCallback(async () => {
        try {
            const response = await authFetch(`${API_URL}/workspaces`);
            const data = await response.json();
            if (response.ok) {
                setWorkspaces(data);

                // If no workspace is selected and we have some, select the first one
                if (!currentWorkspace && data.length > 0) {
                    const lastId = localStorage.getItem('lastWorkspaceId');
                    const wsToSelect = lastId
                        ? (data.find((w: Workspace) => w.workspaceId === parseInt(lastId)) || data[0])
                        : data[0];
                    await selectWorkspace(wsToSelect.workspaceId);
                }
            }
        } catch (err) {
            console.error('Failed to fetch workspaces:', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace]);

    const selectWorkspace = async (id: number) => {
        try {
            const response = await authFetch(`${API_URL}/workspace/${id}`);
            const data = await response.json();
            if (response.ok) {
                setCurrentWorkspace(data);
                localStorage.setItem('lastWorkspaceId', id.toString());
            }
        } catch (err) {
            console.error('Failed to select workspace:', err);
        }
    };

    const createWorkspace = async (name: string, network: 'mainnet' | 'devnet'): Promise<Workspace | null> => {
        try {
            const response = await authFetch(`${API_URL}/workspace`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, network }),
            });
            const data = await response.json();
            if (response.ok) {
                await refreshWorkspaces();
                await selectWorkspace(data.workspaceId);
                return { workspaceId: data.workspaceId, name, network };
            }
        } catch (err) {
            console.error('Failed to create workspace:', err);
        }
        return null;
    };

    const updateWorkspace = async (id: number, name: string, network: 'mainnet' | 'devnet') => {
        try {
            const response = await authFetch(`${API_URL}/workspace/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, network }),
            });
            if (response.ok) {
                if (currentWorkspace?.workspaceId === id) {
                    setCurrentWorkspace({ ...currentWorkspace, name, network });
                }
                await refreshWorkspaces();
            }
        } catch (err) {
            console.error('Failed to update workspace:', err);
        }
    };

    useEffect(() => {
        refreshWorkspaces();
    }, []);

    return (
        <WorkspaceContext.Provider
            value={{
                currentWorkspace,
                workspaces,
                isLoading,
                selectWorkspace,
                refreshWorkspaces,
                createWorkspace,
                updateWorkspace,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
};
