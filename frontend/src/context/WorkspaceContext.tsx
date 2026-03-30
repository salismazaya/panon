import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { API_URL, authFetch } from '../utils/api';

export interface Workspace {
    workspaceId: number;
    name: string;
    address?: string;
}

interface WorkspaceContextType {
    currentWorkspace: Workspace | null;
    workspaces: Workspace[];
    isLoading: boolean;
    notifications: Notification[];
    selectWorkspace: (id: number) => Promise<void>;
    refreshWorkspaces: () => Promise<void>;
    createWorkspace: (name: string) => Promise<Workspace | null>;
    renameWorkspace: (id: number, name: string) => Promise<void>;
    removeNotification: (timestamp: number) => void;
}

export interface Notification {
    workspaceId: number;
    name: string;
    amount: number;
    sender: string;
    signature: string;
    timestamp: number;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // SSE Setup for notifications
    useEffect(() => {
        const eventSource = new EventSource(`${API_URL}/events`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const notification: Notification = {
                    ...data,
                    timestamp: Date.now(),
                };

                setNotifications(prev => [notification, ...prev].slice(0, 5));

                // Auto-remove after 5 seconds
                setTimeout(() => {
                    setNotifications(prev => prev.filter(n => n.timestamp !== notification.timestamp));
                }, 5000);
            } catch (err) {
                console.error('Failed to parse SSE message:', err);
            }
        };

        return () => eventSource.close();
    }, []);

    const removeNotification = (timestamp: number) => {
        setNotifications(prev => prev.filter(n => n.timestamp !== timestamp));
    };

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

    const createWorkspace = async (name: string): Promise<Workspace | null> => {
        try {
            const response = await authFetch(`${API_URL}/workspace`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await response.json();
            if (response.ok) {
                await refreshWorkspaces();
                await selectWorkspace(data.workspaceId);
                return { workspaceId: data.workspaceId, name };
            }
        } catch (err) {
            console.error('Failed to create workspace:', err);
        }
        return null;
    };

    const renameWorkspace = async (id: number, name: string) => {
        try {
            const response = await authFetch(`${API_URL}/workspace/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (response.ok) {
                if (currentWorkspace?.workspaceId === id) {
                    setCurrentWorkspace({ ...currentWorkspace, name });
                }
                await refreshWorkspaces();
            }
        } catch (err) {
            console.error('Failed to rename workspace:', err);
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
                notifications,
                selectWorkspace,
                refreshWorkspaces,
                createWorkspace,
                renameWorkspace,
                removeNotification,
            }}
        >
            {children}

            {/* Notification UI */}
            <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-9999 pointer-events-none">
                {notifications.map((n) => (
                    <div
                        key={n.timestamp}
                        className="pointer-events-auto bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-right w-80"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 px-2 py-0.5 border-2 border-emerald-500">
                                Inbound Transaction
                            </span>
                            <button onClick={() => removeNotification(n.timestamp)} className="text-slate-400 hover:text-black">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <h4 className="font-black text-sm uppercase mb-1">{n.name}</h4>
                        <p className="text-xl font-black mb-3 text-black">+{n.amount} SOL</p>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-black text-slate-400">From: {n.sender.slice(0, 8)}...</span>
                            <a
                                href={`https://solscan.io/tx/${n.signature}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] uppercase font-black text-blue-500 hover:underline"
                            >
                                View on Solscan
                            </a>
                        </div>
                    </div>
                ))}
            </div>
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
