import { useKey } from '../context/KeyContext';

interface KeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyModal = ({ isOpen, onClose }: KeyModalProps) => {
  const { address } = useKey();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-xl font-black uppercase tracking-tight mb-6">
          Wallet
        </h2>

        {address && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border-2 border-black">
              <p className="text-xs font-black uppercase tracking-widest text-black mb-2">
                Connected Address
              </p>
              <p className="font-mono text-sm break-all bg-white p-2 border-2 border-black">
                {address}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-black border-2 border-black text-white font-black uppercase text-xs tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
