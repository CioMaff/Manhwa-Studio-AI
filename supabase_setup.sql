-- Create the projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own projects" 
    ON public.projects FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" 
    ON public.projects FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
    ON public.projects FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
    ON public.projects FOR DELETE 
    USING (auth.uid() = user_id);

-- Create an index for faster queries by user_id
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects(user_id);

-- Create a storage bucket for project assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public Access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'project-assets');

CREATE POLICY "Users can upload their own assets" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'project-assets' AND auth.uid() = owner);

CREATE POLICY "Users can update their own assets" 
    ON storage.objects FOR UPDATE 
    USING (bucket_id = 'project-assets' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own assets" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'project-assets' AND auth.uid() = owner);
