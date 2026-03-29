import Playground from "./components/Playground";
import Sidebar from "./components/Sidebar";
import { Header } from "./components/Header";
import { FlowProvider } from "./context/FlowContext";
import { KeyProvider } from "./context/KeyContext";

export default function App() {
  return (
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
  );
}