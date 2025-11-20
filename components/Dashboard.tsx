import React, { useEffect, useState } from 'react';
import type { Project } from '../types';
import { getUserProjects, createNewProject, saveProjectToStorage } from '../utils/storage';
import { PlusIcon } from './icons/PlusIcon';
import { Loader } from './Loader';

interface DashboardProps {
    username: string;
    onSelectProject: (project: Project) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ username, onSelectProject }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const userProjects = await getUserProjects(username);
            setProjects(userProjects.sort((a, b) => parseInt(b.id.split('-').pop() || '0') - parseInt(a.id.split('-').pop() || '0')));
            setLoading(false);
        };
        load();
    }, [username]);

    const handleCreate = async () => {
        const newProject = createNewProject(username);
        await saveProjectToStorage(username, newProject);
        setProjects([newProject, ...projects]);
    };

    if (loading) return <Loader message="Loading Library..." />;

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h2 className="text-4xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Manhwa AI Studio</h2>
                        <p className="text-gray-400 mt-2 text-sm">Create professional webtoons with Nano Banana Pro (Gemini 3.0).</p>
                    </div>
                    <button 
                        onClick={handleCreate} 
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-gray-200 rounded-xl font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <PlusIcon className="w-4 h-4" /> New Project
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {/* Create New Card (Quick Access) */}
                    <button 
                        onClick={handleCreate} 
                        className="group aspect-[2/3] rounded-2xl border border-dashed border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-white/20 transition-all flex flex-col items-center justify-center gap-4"
                    >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <PlusIcon className="w-6 h-6 text-violet-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-400 group-hover:text-gray-200 transition-colors">Create New</span>
                    </button>

                    {projects.map(project => (
                        <div 
                            key={project.id} 
                            onClick={() => onSelectProject(project)} 
                            className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-violet-500/50 transition-all duration-300 shadow-lg hover:shadow-violet-500/10 cursor-pointer"
                        >
                            {/* Image Container */}
                            <div className="absolute inset-0 bg-zinc-800 overflow-hidden">
                                <img 
                                    src={project.coverImagePreview || project.coverImage} 
                                    alt={project.title} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" 
                                />
                            </div>
                            
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />
                            
                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                <h3 className="font-bold text-lg text-white mb-1 line-clamp-2 leading-snug group-hover:text-violet-200 transition-colors">{project.title}</h3>
                                <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/60">{project.chapters.length} Chapters</p>
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {projects.length === 0 && (
                    <div className="text-center py-32">
                        <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
                            <PlusIcon className="w-8 h-8 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Your library is empty</h3>
                        <p className="text-gray-400 max-w-sm mx-auto">Ready to tell your story? Create your first project to begin the journey.</p>
                    </div>
                )}
            </div>
        </div>
    );
};