import React, { useState, useEffect } from 'react';
import type { Project } from '../types';
import { EditIcon } from './icons/EditIcon';
import { PlayIcon } from './icons/PlayIcon';
import { saveProjectToStorage } from '../utils/storage';

interface ProjectLandingProps {
    project: Project;
    username: string;
    onEdit: () => void;
    onRead: () => void;
    onBack: () => void;
    onUpdateProjectLocal: (p: Project) => void;
}

export const ProjectLanding: React.FC<ProjectLandingProps> = ({ project, username, onEdit, onRead, onBack, onUpdateProjectLocal }) => {
    const [title, setTitle] = useState(project.title);

    useEffect(() => {
        setTitle(project.title);
    }, [project.title]);

    const handleTitleSave = async () => {
        if (title.trim() !== project.title) {
            const updated = { ...project, title: title.trim() };
            onUpdateProjectLocal(updated);
            await saveProjectToStorage(username, updated);
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-background text-white relative">
            {/* Cinematic Background Blur */}
            <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-violet-900/20 to-background pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-[500px] opacity-10 pointer-events-none">
                <img src={project.coverImage} className="w-full h-full object-cover blur-3xl scale-110" />
            </div>

            <div className="max-w-6xl mx-auto p-8 relative z-10">
                <button onClick={onBack} className="mb-8 text-gray-400 hover:text-white flex items-center gap-2 text-sm font-semibold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full transition-all w-fit">
                    &larr; Library
                </button>

                <div className="flex flex-col md:flex-row gap-12 items-start">
                    {/* Cover Art Section */}
                    <div className="w-full md:w-[320px] flex-shrink-0">
                        <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 relative group">
                             <img src={project.coverImage} alt="Cover" className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="flex-1 flex flex-col pt-4">
                        <div className="mb-8">
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={handleTitleSave}
                                className="w-full bg-transparent text-5xl md:text-7xl font-black text-white border-b-2 border-transparent hover:border-white/10 focus:border-violet-500 focus:outline-none pb-4 transition-all tracking-tight"
                            />
                            <p className="text-gray-400 mt-4 text-lg">Last updated just now</p>
                        </div>

                        <div className="flex gap-6 mb-12">
                             <button onClick={onRead} className="flex-1 max-w-xs bg-white text-black hover:bg-gray-200 py-4 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1">
                                <PlayIcon className="w-6 h-6" /> READ
                             </button>
                             <button onClick={onEdit} className="flex-1 max-w-xs bg-white/10 text-white hover:bg-white/20 py-4 rounded-2xl font-bold text-lg shadow-lg border border-white/10 backdrop-blur-md flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1">
                                <EditIcon className="w-6 h-6" /> STUDIO
                             </button>
                        </div>

                        <div className="bg-zinc-900/50 backdrop-blur-md rounded-3xl p-8 border border-white/5 flex-grow shadow-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold flex items-center gap-3">
                                    <span className="w-2 h-8 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-full"></span>
                                    Episodes
                                </h3>
                                <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-gray-400 uppercase tracking-wider">{project.chapters.length} Chapters</span>
                            </div>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {project.chapters.map((chapter, idx) => (
                                    <div key={chapter.id} className="flex justify-between items-center p-5 bg-zinc-900/80 hover:bg-zinc-800 rounded-2xl border border-white/5 transition-all group">
                                        <div className="flex items-center gap-6">
                                            <span className="text-3xl font-black text-white/10 group-hover:text-violet-500/50 transition-colors w-12">{(idx + 1).toString().padStart(2, '0')}</span>
                                            <div>
                                                <h4 className="font-bold text-gray-200 text-lg group-hover:text-white transition-colors">{chapter.title}</h4>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">{chapter.panels.length} Panels</p>
                                            </div>
                                        </div>
                                        <button onClick={onRead} className="text-sm text-black bg-white hover:bg-gray-200 font-bold px-5 py-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            Play
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};