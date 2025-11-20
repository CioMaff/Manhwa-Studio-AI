// --- START: Toast Notification System ---
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const showToast = (message: string, type: Toast['type'] = 'info') => {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
};
// --- END: Toast Notification System ---

// --- START: Confirmation Modal System ---
interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string;
}

type ConfirmationPromise = {
    resolve: (value: boolean) => void;
};

let confirmationPromiseResolver: ConfirmationPromise | null = null;

export const showConfirmation = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
        confirmationPromiseResolver = { resolve };
        window.dispatchEvent(new CustomEvent('show-confirmation', { detail: { detail: options } }));
    });
};

// This function is intended to be called from the main App component where the modal lives
export const handleConfirmation = (confirmed: boolean) => {
    if (confirmationPromiseResolver) {
        confirmationPromiseResolver.resolve(confirmed);
        confirmationPromiseResolver = null;
    }
};
// --- END: Confirmation Modal System ---