
import type { Project } from '../types';
import { showToast } from '../systems/uiSystem';
import { saveToDB, getFromDB, getAllFromDB, deleteFromDB } from './idb';
import { supabase } from './supabaseClient';

/*
    --- SISTEMA DE ALMACENAMIENTO HÍBRIDO (CLOUD FIRST) ---
    Prioridad: Supabase (Nube) -> IndexedDB (Local Backup)
*/

// Older projects in Supabase were saved before some collection fields existed
// (knowledgeBase, dialogueStyles, backgrounds, agentHistory, chatHistory, etc.).
// When those come back as `undefined`, any `.map` / `.flatMap` / `.length` in the
// UI crashes. Normalise once at the load boundary so consumers can treat every
// collection as a real array.
const normalizeProject = (raw: any): Project => {
    if (!raw || typeof raw !== 'object') return raw as Project;
    // Repair any panel whose `layout` has a different number of unique cells than
    // its `subPanels` array. Previously handleDeleteSubPanel filtered the
    // subPanels but left `layout` untouched, so old projects can come back with
    // e.g. a 3-row layout but only 2 subpanels — the trailing row renders as a
    // big black void and the idx→layout-value mapping used by getGridArea goes
    // out of sync. Rebuilding to a simple vertical stack matches subpanel count
    // and keeps the grid sound.
    const repairPanel = (p: any) => {
        const subPanels = Array.isArray(p?.subPanels) ? p.subPanels : [];
        const dialogueBubbles = Array.isArray(p?.dialogueBubbles) ? p.dialogueBubbles : [];
        const layout = Array.isArray(p?.layout) ? p.layout : [[1]];
        const unique = Array.from(new Set(layout.flat().filter((v: any) => typeof v === 'number')));
        const n = subPanels.length;
        const needsRebuild = n > 0 && unique.length !== n;
        const finalLayout = needsRebuild
            ? Array.from({ length: n }, (_, i) => [i + 1])
            : layout;
        return { ...p, subPanels, dialogueBubbles, layout: finalLayout };
    };
    return {
        ...raw,
        chapters: Array.isArray(raw.chapters) ? raw.chapters.map((c: any) => ({
            ...c,
            panels: Array.isArray(c?.panels) ? c.panels.map(repairPanel) : [],
        })) : [],
        characters: Array.isArray(raw.characters) ? raw.characters : [],
        objects: Array.isArray(raw.objects) ? raw.objects : [],
        backgrounds: Array.isArray(raw.backgrounds) ? raw.backgrounds : [],
        styleReferences: Array.isArray(raw.styleReferences) ? raw.styleReferences : [],
        dialogueStyles: Array.isArray(raw.dialogueStyles) ? raw.dialogueStyles : [],
        knowledgeBase: Array.isArray(raw.knowledgeBase) ? raw.knowledgeBase : [],
        agentHistory: Array.isArray(raw.agentHistory) ? raw.agentHistory : [],
        chatHistory: Array.isArray(raw.chatHistory) ? raw.chatHistory : [],
        settings: raw.settings ?? { pageWidth: 800, panelSpacing: 0, maxConcurrentGenerations: 1 },
    } as Project;
};

// Helper to convert base64 to Blob safely
const base64ToBlob = (base64: string, mimeType: string) => {
    try {
        // Remove the data URL prefix if present
        let base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        
        // Decode URI component in case it's URL encoded
        try {
            base64Data = decodeURIComponent(base64Data);
        } catch (e) {
            // Ignore if not URL encoded
        }
        
        // Remove whitespace and any characters not valid in base64
        base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Pad with '=' to make length a multiple of 4
        while (base64Data.length % 4 !== 0) {
            base64Data += '=';
        }
        
        const byteString = atob(base64Data);
        
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        return new Blob([ab], { type: mimeType });
    } catch (e) {
        console.error("Failed to convert base64 to blob:", e);
        throw new Error("Invalid base64 string");
    }
};

// Helper to upload base64 image to Supabase Storage
const uploadImageToStorage = async (base64: string, path: string): Promise<string | null> => {
    if (!base64 || typeof base64 !== 'string') return null;
    if (!base64.startsWith('data:image')) return base64; // Already a URL or invalid format

    // Skip placeholders and truncated data URLs rather than spamming upload errors.
    // A real PNG is way bigger than ~200 bytes; anything smaller is almost certainly
    // a placeholder, a failed generation, or a cached corrupt entry.
    const commaIdx = base64.indexOf(',');
    if (commaIdx < 0 || base64.length - commaIdx - 1 < 200) return null;
    if (/PLACEHOLDER/i.test(base64.slice(0, 120))) return null;

    try {
        const mimeTypeMatch = base64.match(/data:(.*?);/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
        const fileExt = mimeType.split('/')[1] || 'png';
        
        // Ensure path doesn't have invalid characters
        const safePath = path.replace(/[^a-zA-Z0-9-_/]/g, '_');
        const fileName = `${safePath}-${Date.now()}.${fileExt}`;

        const blob = base64ToBlob(base64, mimeType);

        const { data, error } = await supabase.storage
            .from('project-assets')
            .upload(fileName, blob, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("Supabase upload error:", error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('project-assets')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.error("Error uploading image:", error);
        return null; // Return null on failure so we don't overwrite with bad data
    }
};

// Recursive function to process project data and upload images
const processProjectImages = async (project: Project, username: string): Promise<Project> => {
    const newProject = JSON.parse(JSON.stringify(project)) as Project;
    const basePath = `${username}/${project.id}`;

    // Helper to process a single image field
    const processField = async (obj: any, field: string, pathSuffix: string) => {
        if (obj && obj[field] && obj[field].startsWith('data:image')) {
            const url = await uploadImageToStorage(obj[field], `${basePath}/${pathSuffix}`);
            if (url) obj[field] = url;
        }
    };

    // Process Cover Images
    await processField(newProject, 'coverImage', 'cover');
    await processField(newProject, 'coverImagePreview', 'cover-preview');

    // Process Characters
    if (newProject.characters) {
        for (let i = 0; i < newProject.characters.length; i++) {
            await processField(newProject.characters[i], 'imageUrl', `char-${newProject.characters[i].id}`);
        }
    }

    // Process Backgrounds
    if (newProject.backgrounds) {
        for (let i = 0; i < newProject.backgrounds.length; i++) {
            await processField(newProject.backgrounds[i], 'imageUrl', `bg-${newProject.backgrounds[i].id}`);
        }
    }

    // Process Objects
    if (newProject.objects) {
        for (let i = 0; i < newProject.objects.length; i++) {
            await processField(newProject.objects[i], 'imageUrl', `obj-${newProject.objects[i].id}`);
        }
    }

    // Process Style References
    if (newProject.styleReferences) {
        for (let i = 0; i < newProject.styleReferences.length; i++) {
            await processField(newProject.styleReferences[i], 'imageUrl', `style-${newProject.styleReferences[i].id}`);
        }
    }

    // Process Chapters -> Panels -> SubPanels
    if (newProject.chapters) {
        for (const chapter of newProject.chapters) {
            if (chapter.panels) {
                for (const panel of chapter.panels) {
                    if (panel.subPanels) {
                        for (const subPanel of panel.subPanels) {
                            await processField(subPanel, 'imageUrl', `panel-${panel.id}-sub-${subPanel.id}`);
                        }
                    }
                }
            }
        }
    }

    return newProject;
};

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
    // 1. CLOUD FIRST: Supabase. RLS already constrains rows to auth.uid(), but we
    // also pass `.eq('user_id', username)` as defense-in-depth against policy
    // drift. With the guest-mode loophole removed, `username` is always a real
    // Supabase auth user id.
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('data')
            .eq('user_id', username);

        if (!error && data) {
            console.log("✅ Loaded projects from Supabase (Cloud)");
            return data.map((row: any) => normalizeProject(row.data));
        } else if (error) {
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.warn("⚠️ Supabase unreachable (Offline Mode).");
            } else {
                console.warn("⚠️ Supabase load error:", error.message);
                if (error.code === '42P01') {
                    showToast("Falta configurar la Base de Datos en Supabase.", "error");
                }
            }
        }
    } catch (e) {
        console.warn("⚠️ Supabase connection failed:", e);
    }

    // 2. FALLBACK LOCAL: Si falla la nube, usar local
    console.log("📂 Loading from Local DB (Fallback/Offline)");
    try {
        const allLocal = await getAllFromDB();
        const localProjects = allLocal
            .filter((p: Project) => p.id.startsWith(`proj-${username}`))
            .map(normalizeProject);
        if (localProjects.length > 0) {
            showToast("Modo Offline: Usando copia local.", "info");
            return localProjects;
        }
    } catch (localErr) {
        console.error("Critical: Failed to load from both Cloud and Local DB");
    }

    return [];
};

export const saveProjectToStorage = async (username: string, project: Project) => {
    // 1. Guardar localmente siempre (Backup instantáneo con Base64)
    try {
        await saveToDB('projects', project);
    } catch (e) {
        console.error("Local save failed", e);
    }

    // 2. Procesar imágenes a URLs para la nube
    let projectToSave: Project;
    try {
        projectToSave = await processProjectImages(project, username);
    } catch (e) {
        console.error("Error processing images for cloud save", e);
        projectToSave = { ...project }; // Fallback a Base64 si falla
    }

    // 3. Guardar en Supabase (Sync Principal). Safe upsert: explicit onConflict
    // on the primary key prevents duplicate-row 409s on concurrent saves and
    // makes the intent unambiguous (CLAUDE.md rule 2).
    try {
        const { error } = await supabase
            .from('projects')
            .upsert({
                id: project.id,
                user_id: username,
                title: project.title,
                data: projectToSave,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            // Handle Network Errors / Offline gracefully
            const errorMsg = error.message || '';
            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('TypeError')) {
                console.warn("Cloud save skipped (Offline/Network).");
                return; 
            }

            console.error("Cloud save failed:", errorMsg);
            
            // Handle Missing Table (setup required) vs other errors
            if (errorMsg.includes('relation "public.projects" does not exist')) {
                // Silent fail, handled in Settings
            } else {
                showToast("Error guardando en nube.", "warning");
            }
        }
    } catch (error: any) {
        const msg = error?.message || String(error);
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
             console.warn("Cloud sync skipped (Network catch).");
        } else {
             console.error("Cloud sync exception:", error);
        }
    }
};

export const deleteProject = async (projectId: string, username?: string) => {
    // 1. Borrar Nube. RLS scopes this to auth.uid() already, but we add an
    // explicit user_id filter as defense-in-depth against RLS policy drift.
    try {
        let query = supabase
            .from('projects')
            .delete()
            .eq('id', projectId);
        if (username) query = query.eq('user_id', username);
        const { error } = await query;

        if (error) throw error;
    } catch (error: any) {
        if (!error.message?.includes('Failed to fetch')) {
            console.error("Failed to delete cloud project", error);
            showToast("Error borrando de la nube.", 'error');
        }
    }

    // 2. Borrar Local
    try {
        await deleteFromDB('projects', projectId);
    } catch (error) {
        console.error("Failed to delete local project", error);
    }
    
    showToast("Proyecto eliminado.", "success");
};
