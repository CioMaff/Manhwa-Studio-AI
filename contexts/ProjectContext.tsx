import React, { createContext, useContext } from 'react';
import type { Project } from '../types';

interface ProjectContextType {
    project: Project;
    updateProject: (updater: (prev: Project) => Project) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider = ProjectContext.Provider;

export const useProject = (): ProjectContextType => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};