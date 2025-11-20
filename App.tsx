import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Studio } from './components/Studio';
import { Auth } from './components/Auth';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ProjectProvider } from './contexts/ProjectContext';
import type { Project } from './types';
import { getDefaultProject, loadProjectFromStorage } from './utils/storage';
import { handleConfirmation, showConfirmation } from './systems/uiSystem';
import { Loader } from './components/Loader';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string;
}

const ToastMessage: React.FC<{ toast: Toast; onRemove: (id: number) => void }> = ({ toast, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    const baseClasses = "flex items-center w-full max-w-xs p-4 mb-4 text-gray-200 bg-gray-800 rounded-lg shadow-lg border";
    const typeClasses = {
        success: "border-green-500/50",
        error: "border-red-500/50",
        info: "border-blue-500/50",
    };
    const Icon = {
        success: () => <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>,
        error: () => <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>,
        info: () => <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>,
    };

    return (
        <div className={`${baseClasses} ${typeClasses[toast.type]}`} role="alert">
            <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg">
                {Icon[toast.type]()}
            </div>
            <div className="ml-3 text-sm font-normal">{toast.message}</div>
            <button type="button" className="ml-auto -mx-1.5 -my-1.5 bg-gray-800 text-gray-400 hover:text-white rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-700 inline-flex h-8 w-8" onClick={() => onRemove(toast.id)}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.697a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
        </div>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div className="fixed top-5 right-5 z-[100]">
        {toasts.map((toast) => (
            <ToastMessage key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
    </div>
);

function App() {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('gemini-manhwa-user'));
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState('Gemini Manhwa Studio');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmationProps, setConfirmationProps] = useState<ConfirmationOptions & { isOpen: boolean }>({
    isOpen: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    const initProject = async () => {
        if (user) {
            setIsLoadingProject(true);
            let loadedProject = await loadProjectFromStorage(user);
            if (!loadedProject) {
                loadedProject = getDefaultProject(user);
            }
            if (loadedProject.chapters.length === 0) {
                loadedProject.chapters = getDefaultProject(user).chapters;
            }
            setProject(loadedProject);
            setIsLoadingProject(false);
        } else {
            setProject(null);
        }
    };
    initProject();
  }, [user]);

  const updateProject = useCallback((updater: (p: Project) => Project) => {
      setProject(prev => {
          if (!prev) return null;
          const newProject = updater(prev);
          return newProject;
      });
  }, []);

  const providerValue = useMemo(() => (project ? { project, updateProject } : null), [project, updateProject]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const onConfirm = () => {
    handleConfirmation(true);
    setConfirmationProps({ ...confirmationProps, isOpen: false });
  };

  const onCancel = () => {
    handleConfirmation(false);
    setConfirmationProps({ ...confirmationProps, isOpen: false });
  };

  useEffect(() => {
    const handleShowToast = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        addToast(detail.message, detail.type);
    };
    const handleShowConfirmation = (e: Event) => {
        const detail = (e as CustomEvent).detail.detail;
        setConfirmationProps({ ...detail, isOpen: true });
    };
    window.addEventListener('show-toast', handleShowToast);
    window.addEventListener('show-confirmation', handleShowConfirmation);
    return () => {
        window.removeEventListener('show-toast', handleShowToast);
        window.removeEventListener('show-confirmation', handleShowConfirmation);
    };
  }, [addToast]);
  
  const handleLogin = (username: string) => {
      localStorage.setItem('gemini-manhwa-user', username);
      setUser(username);
  };

  const handleLogout = async () => {
      const confirmed = await showConfirmation({
        title: 'Confirm Logout',
        message: 'Are you sure you want to logout? Your work is saved in this browser.',
        confirmButtonClass: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
      });
      if (confirmed) {
        localStorage.removeItem('gemini-manhwa-user');
        setUser(null);
        setProjectTitle('Gemini Manhwa Studio');
      }
  };

  return (
    <div className="h-full bg-gray-900 font-sans flex flex-col">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmationModal
        isOpen={confirmationProps.isOpen}
        onClose={onCancel}
        onConfirm={onConfirm}
        title={confirmationProps.title}
        message={confirmationProps.message}
        confirmText={confirmationProps.confirmText}
        cancelText={confirmationProps.cancelText}
        confirmButtonClass={confirmationProps.confirmButtonClass}
      />
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg flex justify-between items-center z-20 flex-shrink-0">
        <h1 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 truncate">
          {projectTitle} <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 ml-2 align-middle">PRO</span>
        </h1>
        {user && (
            <button onClick={handleLogout} className="bg-red-600 text-white font-bold py-1 px-3 rounded-md hover:bg-red-700 transition-colors text-sm">
                Logout
            </button>
        )}
      </header>
      <main className="flex-1 overflow-y-auto relative">
         {user && providerValue && !isLoadingProject ? (
            <ProjectProvider value={providerValue}>
                <Studio username={user} setProjectTitle={setProjectTitle} />
            </ProjectProvider>
         ) : user || isLoadingProject ? (
            <div className="flex items-center justify-center h-full text-gray-400">
                <Loader message="Loading Massive Project Memory..." />
            </div>
         ) : (
            <Auth onLogin={handleLogin} />
         )}
      </main>
    </div>
  );
}

export default App;