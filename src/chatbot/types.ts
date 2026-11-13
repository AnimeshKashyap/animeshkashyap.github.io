export type KnowledgeRecordType =
  | 'profile'
  | 'experience'
  | 'project'
  | 'skill'
  | 'education'
  | 'faq'
  | 'unavailable';

export interface KnowledgeRecord {
  id: string;
  type: KnowledgeRecordType;
  title: string;
  text: string;
  tags: string[];
  aliases?: string[];
  source: string;
  available: boolean;
}

export type ActionId = 'cv' | 'email' | 'linkedin' | 'github' | 'projects';

export interface Reply {
  text: string;
  sources: { id: string; label: string }[];
  actions: ActionId[];
  suggestions: string[];
  confident: boolean;
}

export interface ChatEngine {
  ask(query: string): Promise<Reply>;
}
