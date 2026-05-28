export type DocCategory = 'pitch' | 'tech' | 'live';

export interface DocSection {
  id: string;
  slug: string;
  title: string;
  content: string; // Markdown content
  section_order: number;
  category: DocCategory;
  is_active: boolean;
  updated_at: string;
}

export interface DocSettings {
  is_public: boolean;
  start_time: string;
  end_time: string;
}

export interface TeamMember {
  name: string;
  role: string;
  email: string;
  image_url?: string;
}
