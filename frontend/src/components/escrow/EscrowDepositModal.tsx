/**
 * EscrowDepositModal -- DEPRECATED.
 * Replaced by SendToAddress component in Phase 2 refactor.
 * Kept as a stub to avoid breaking imports. Use SendToAddress instead.
 *
 * @deprecated Use SendToAddress for all deposit flows.
 * @module components/escrow/EscrowDepositModal
 */

/** Props for the EscrowDepositModal component. */
export interface EscrowDepositModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly amount: number;
}

/**
 * @deprecated Replaced by SendToAddress. This component now renders nothing.
 */
export function EscrowDepositModal({
  isOpen,
}: EscrowDepositModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 text-center">
        <p className="text-yellow-400 text-sm">
          This deposit modal has been replaced. Please use the &quot;Send to Address&quot; flow instead.
        </p>
      </div>
    </div>
  );
}
