import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Studio } from './components/Studio';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { ProjectLanding } from './components/ProjectLanding';
import { Reader } from './components/Reader';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ProjectProvider } from './contexts/ProjectContext';
import type { Project } from './types';
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

    const baseClasses = "flex items-center w-full max-w-xs p-4 mb-4 text-gray-100 bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/5";
    const typeClasses = {
        success: "border-l-4 border-l-green-500",
        error: "border-l-4 border-l-red-500",
        info: "border-l-4 border-l-violet-500",
    };

    return (
        <div className={`${baseClasses} ${typeClasses[toast.type]} animate-fade-in-up`} role="alert">
            <div className="ml-2 text-sm font-medium">{toast.message}</div>
            <button type="button" className="ml-auto -mx-1.5 -my-1.5 bg-transparent text-gray-400 hover:text-white rounded-lg p-1.5 hover:bg-white/10 inline-flex h-8 w-8 transition-colors" onClick={() => onRemove(toast.id)}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.697a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
        </div>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
            <ToastMessage key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
    </div>
);

type ViewState = 'auth' | 'dashboard' | 'landing' | 'editor' | 'reader';

function App() {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('gemini-manhwa-user'));
  const [currentView, setCurrentView] = useState<ViewState>(user ? 'dashboard' : 'auth');
  const [project, setProject] = useState<Project | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmationProps, setConfirmationProps] = useState<ConfirmationOptions & { isOpen: boolean }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // When project changes, update provider value
  const updateProject = useCallback((updater: (p: Project) => Project) => {
      setProject(prev => {
          if (!prev) return null;
          return updater(prev);
      });
  }, []);

  const providerValue = useMemo(() => (project ? { project, updateProject } : null), [project, updateProject]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

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
      setCurrentView('dashboard');
  };

  const handleLogout = async () => {
      const confirmed = await showConfirmation({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out? Your session will be closed.',
        confirmButtonClass: 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
      });
      if (confirmed) {
        localStorage.removeItem('gemini-manhwa-user');
        setUser(null);
        setProject(null);
        setCurrentView('auth');
      }
  };

  const handleSelectProject = (p: Project) => {
      setProject(p);
      setCurrentView('landing');
  };

  const handleEnterStudio = () => {
      setCurrentView('editor');
  };
  
  const handleEnterReader = () => {
      setCurrentView('reader');
  }

  const handleBackToDashboard = () => {
      setProject(null);
      setCurrentView('dashboard');
  };
  
  const handleBackToLanding = () => {
      setCurrentView('landing');
  }

  const onConfirm = () => {
    handleConfirmation(true);
    setConfirmationProps({ ...confirmationProps, isOpen: false });
  };

  const onCancel = () => {
    handleConfirmation(false);
    setConfirmationProps({ ...confirmationProps, isOpen: false });
  };

  const renderContent = () => {
      if (!user) return <Auth onLogin={handleLogin} />;

      switch (currentView) {
          case 'dashboard':
              return <Dashboard username={user} onSelectProject={handleSelectProject} />;
          case 'landing':
              return project ? (
                  <ProjectLanding 
                      project={project} 
                      username={user} 
                      onEdit={handleEnterStudio} 
                      onRead={handleEnterReader}
                      onBack={handleBackToDashboard}
                      onUpdateProjectLocal={(p) => setProject(p)}
                  />
              ) : <Loader message="Loading Project..." />;
          case 'editor':
              return project && providerValue ? (
                  <ProjectProvider value={providerValue}>
                      <Studio 
                          username={user} 
                          setProjectTitle={(t) => setProject(p => p ? ({...p, title: t}) : null)} 
                          onExit={handleBackToLanding}
                      />
                  </ProjectProvider>
              ) : <Loader message="Loading Studio..." />;
          case 'reader':
              return project ? (
                  <Reader project={project} onBack={handleBackToLanding} />
              ) : <Loader message="Loading Reader..." />;
          default:
              return <Auth onLogin={handleLogin} />;
      }
  };

  return (
    <div className="h-full bg-background font-sans flex flex-col text-gray-200">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background pointer-events-none" />
      
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
      
      {currentView === 'dashboard' && (
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <span className="text-white font-bold text-lg">M</span>
                 </div>
                 <h1 className="text-xl font-bold tracking-tight">
                    <span className="text-white">Manhwa AI</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400"> Studio</span>
                 </h1>
                 <span className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/50 px-2 py-0.5 rounded-full border border-white/5 ml-2">Pro</span>
            </div>
            {user && (
                <div className="flex items-center gap-4">
                    <div className="text-xs text-gray-400">
                        Logged in as <span className="text-white font-medium">{user}</span>
                    </div>
                    <button onClick={handleLogout} className="text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all">
                        Sign Out
                    </button>
                </div>
            )}
        </header>
      )}
      <main className="flex-1 overflow-hidden relative z-10">
         {renderContent()}
      </main>
    </div>
  );
}

export default App;