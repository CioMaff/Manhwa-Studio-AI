import type { Project } from '../types';
import { showToast } from '../systems/uiSystem';
import { saveToDB, getFromDB } from './idb';

export const getDefaultProject = (username: string): Project => ({
    id: `proj-${username}`,
    title: `${username}'s First Manhwa`,
    coverImage: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1080 1920'%3E%3Crect width='1080' height='1920' fill='%23111827'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='sans-serif' font-size='48'%3ECover Art%3C/text%3E%3C/svg%3E`,
    coverImagePreview: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1080 1920'%3E%3Crect width='1080' height='1920' fill='%23111827'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='sans-serif' font-size='48'%3ECover Art%3C/text%3E%3C/svg%3E`,
    chapters: [{ id: 'chap-1', title: 'Chapter 1', panels: [] }],
    characters: [],
    objects: [],
    backgrounds: [],
    styleReferences: [],
    dialogueStyles: [],
    knowledgeBase: [],
    settings: {
        pageWidth: 800,
        panelSpacing: 0,
        maxConcurrentGenerations: 1, // Strict default limit for Pro models
    },
    agentHistory: [],
    chatHistory: [],
});

export const loadProjectFromStorage = async (username: string): Promise<Project | null> => {
    try {
        // Try IDB first
        const projectId = `proj-${username}`;
        const dbProject = await getFromDB(projectId);
        
        if (dbProject) return dbProject;

        // Fallback to LocalStorage (migration path)
        const localProject = localStorage.getItem(`gemini-manhwa-project-${username}`);
        if (localProject) {
            const project = JSON.parse(localProject);
            // Save to IDB for future
            await saveToDB('projects', project);
            return project;
        }
        return null;
    } catch (error) {
        console.error("Failed to load project from storage", error);
        return null;
    }
};

export const saveProjectToStorage = async (username: string, project: Project) => {
    try {
        const projectToSave = { ...project, id: `proj-${username}` };
        if ('storyAssets' in projectToSave) {
            delete (projectToSave as any).storyAssets;
        }
        await saveToDB('projects', projectToSave);
    } catch (error) {
        console.error("Failed to save project to storage", error);
        showToast("Error saving project database.", 'error');
    }
};