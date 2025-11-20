
import type { Project } from '../types';
import { showToast } from '../systems/uiSystem';
import { saveToDB, getFromDB, getAllFromDB } from './idb';

export const createNewProject = (username: string): Project => ({
    id: `proj-${username}-${Date.now()}`,
    title: 'New Manhwa Project',
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
        maxConcurrentGenerations: 1,
    },
    agentHistory: [],
    chatHistory: [],
});

export const getUserProjects = async (username: string): Promise<Project[]> => {
    try {
        const allProjects = await getAllFromDB();
        // Filter projects belonging to this user
        return allProjects.filter((p: Project) => p.id.startsWith(`proj-${username}`));
    } catch (error) {
        console.error("Failed to load user projects", error);
        return [];
    }
};

export const saveProjectToStorage = async (username: string, project: Project) => {
    try {
        const projectToSave = { ...project };
        // Ensure we don't save transient properties if any exist
        await saveToDB('projects', projectToSave);
    } catch (error) {
        console.error("Failed to save project to storage", error);
        showToast("Error saving project database.", 'error');
    }
};
