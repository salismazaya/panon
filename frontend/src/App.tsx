import { useState } from "react";
import Playground from "./components/Playground";
import Sidebar from "./components/Sidebar";
import { Header } from "./components/Header";
import { FlowProvider } from "./context/FlowContext";
import { KeyProvider } from "./context/KeyContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./components/LoginPage";

function AuthenticatedApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <WorkspaceProvider>
      <KeyProvider>
        <FlowProvider>
          <div className="flex h-screen w-screen bg-(--neo-bg) text-black overflow-hidden font-sans selection:bg-black/10">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="relative grow flex flex-col min-w-0">
              <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
              <Playground />
            </div>
            {/* Mobile Overlay Backdrop */}
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/40 z-30 lg:hidden" 
                onClick={() => setIsSidebarOpen(false)}
              />
            )}
          </div>
        </FlowProvider>
      </KeyProvider>
    </WorkspaceProvider>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}