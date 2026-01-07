
export interface CDMField {
  objectType: string;
  fieldName: string;
  label: string;
  type: string;
  description: string;
}

export interface MappingSuggestion {
  sourceField: string;
  targetCDMField: string;
  confidence: number;
  reasoning: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export enum ViewMode {
  EXPLORER = 'explorer',
  MAPPER = 'mapper',
  ASSISTANT = 'assistant'
}
