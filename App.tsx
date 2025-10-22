import React, { useState } from 'react';
import { Studio } from './components/Studio';
import { Auth } from './components/Auth';
import type { Project } from './types';

// Función para obtener el proyecto desde localStorage
const loadProjectFromStorage = (username: string): Project | null => {
    try {
        const savedProject = localStorage.getItem(`gemini-manhwa-project-${username}`);
        if (savedProject) {
            const project = JSON.parse(savedProject);
            // Ensure history arrays exist
            if (!project.agentHistory) project.agentHistory = [];
            if (!project.chatHistory) project.chatHistory = [];
            return project;
        }
        return null;
    } catch (error) {
        console.error("Failed to load project from storage", error);
        return null;
    }
};

// Función para guardar el proyecto en localStorage
export const saveProjectToStorage = (username: string, project: Project) => {
    try {
        localStorage.setItem(`gemini-manhwa-project-${username}`, JSON.stringify(project));
    } catch (error) {
        console.error("Failed to save project to storage", error);
        if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
            alert("Error: Project is too large to save. Please try removing some high-resolution images or panels.");
        }
    }
};

function App() {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('gemini-manhwa-user'));
  const [projectTitle, setProjectTitle] = useState('Gemini Manhwa Studio');
  
  const handleLogin = (username: string) => {
      localStorage.setItem('gemini-manhwa-user', username);
      setUser(username);
  };

  const handleLogout = () => {
      if (window.confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('gemini-manhwa-user');
        setUser(null);
        setProjectTitle('Gemini Manhwa Studio');
      }
  };

  return (
    <div className="h-full bg-gray-900 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg flex justify-between items-center z-20 flex-shrink-0">
        <h1 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 truncate">
          {projectTitle}
        </h1>
        {user && (
            <button onClick={handleLogout} className="bg-red-600 text-white font-bold py-1 px-3 rounded-md hover:bg-red-700 transition-colors text-sm">
                Logout
            </button>
        )}
      </header>
      <main className="flex-1 overflow-y-auto">
         {user ? <Studio username={user} loadProject={() => loadProjectFromStorage(user)} setProjectTitle={setProjectTitle} /> : <Auth onLogin={handleLogin} />}
      </main>
    </div>
  );
}

export default App;