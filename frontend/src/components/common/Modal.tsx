import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    showCloseButton?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    showCloseButton = true,
    maxWidth = 'md'
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const titleId = 'modal-dialog-title';

    const maxWidthClasses = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
        '4xl': 'sm:max-w-4xl',
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-stretch justify-center p-0 sm:items-center sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className={`flex w-full max-w-none flex-col overflow-hidden border-0 border-gray-200 bg-surface-light shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-surface-50
                    h-full min-h-0 max-h-none rounded-none sm:h-auto sm:max-h-[min(90vh,56rem)] sm:w-full sm:rounded-2xl sm:border ${maxWidthClasses[maxWidth]}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-white/5">
                        {title ? (
                            <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3>
                        ) : (
                            <div />
                        )}
                        {showCloseButton && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 sm:min-h-10 sm:min-w-10"
                                aria-label="Close modal"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
export { Modal };
