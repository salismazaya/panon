import Playground from "./components/Playground";
import Sidebar from "./components/Sidebar";
import { Header } from "./components/Header";
import { FlowProvider } from "./context/FlowContext";
import { KeyProvider } from "./context/KeyContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./components/LoginPage";

function AuthenticatedApp() {
  return (
    <WorkspaceProvider>
      <KeyProvider>
        <FlowProvider>
          <div className="flex h-screen w-screen bg-(--neo-bg) text-black overflow-hidden font-sans selection:bg-black/10">
            <Sidebar />
            <div className="relative grow flex flex-col">
              <Header />
              <Playground />
            </div>
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