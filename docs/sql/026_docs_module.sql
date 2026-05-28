-- Documentation Module Tables
CREATE TABLE IF NOT EXISTS public.docs_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_public BOOLEAN DEFAULT false,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT '2026-06-10 00:00:00+00',
    end_time TIMESTAMP WITH TIME ZONE DEFAULT '2026-06-14 23:59:59+00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.docs_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Flexible content structure
    section_order INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL CHECK (category IN ('pitch', 'tech', 'live')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Admin Access Policy (Assuming there's a roles system or just check metadata)
-- For now, we'll allow all authenticated users to READ sections if docs_settings.is_public is true, 
-- but only admins to WRITE.

-- Example trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_docs_settings_updated_at BEFORE UPDATE ON public.docs_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_docs_sections_updated_at BEFORE UPDATE ON public.docs_sections FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Seed initial settings
INSERT INTO public.docs_settings (is_public, start_time, end_time)
VALUES (false, '2026-06-10 00:00:00+00', '2026-06-14 23:59:59+00')
ON CONFLICT DO NOTHING;
