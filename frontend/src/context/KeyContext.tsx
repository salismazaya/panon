import { createContext, useContext, type ReactNode } from 'react';
import { useWorkspace } from './WorkspaceContext';

interface KeyContextType {
  address: string | null;
}

const KeyContext = createContext<KeyContextType | null>(null);

export const KeyProvider = ({ children }: { children: ReactNode }) => {
  const { currentWorkspace } = useWorkspace();
  const address = currentWorkspace?.address || null;

  return (
    <KeyContext.Provider
      value={{
        address,
      }}
    >
      {children}
    </KeyContext.Provider>
  );
};

export const useKey = () => {
  const context = useContext(KeyContext);
  if (!context) {
    throw new Error('useKey must be used within a KeyProvider');
  }
  return context;
};
