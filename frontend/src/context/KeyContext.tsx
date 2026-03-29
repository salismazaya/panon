import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface KeyContextType {
  // sessionId: string | null;
  address: string | null;
  // isKeyStored: boolean;
  // storePrivateKey: (privateKey: string) => Promise<{ success: boolean; error?: string }>;
  // clearKey: () => void;
  loadDefaultWallet: () => Promise<void>;
}

const KeyContext = createContext<KeyContextType | null>(null);

export const KeyProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);

  // Load default wallet on mount
  useEffect(() => {
    loadDefaultWallet();
  }, []);

  const loadDefaultWallet = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/wallet`);
      const result = await response.json();

      if (response.ok && result.address) {
        setAddress(result.address);
      }
    } catch (err) {
      console.error('Failed to load default wallet:', err);
    }
  }, []);

  return (
    <KeyContext.Provider
      value={{
        address,
        loadDefaultWallet,
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
