
import { MappingSuggestion } from "../types";

export class GeminiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'http://localhost:8000/api';
  }

  async askAssistant(prompt: string, history: any[] = []) {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, history }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from backend');
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error("Error calling AI Assistant:", error);
      throw error;
    }
  }

  async getMappingSuggestions(sourceData: string): Promise<MappingSuggestion[]> {
    try {
      const response = await fetch(`${this.baseUrl}/map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceData }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from backend');
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting mapping suggestions:", error);
      return [];
    }
  }
}
