
import { CDMField } from "../types";

const DB_NAME = "CDM_Navigator_DB";
const STORE_NAME = "fields";
const DB_VERSION = 1;

export interface SearchResult {
  fields: CDMField[];
  total: number;
  hasMore: boolean;
}

export class DBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
          store.createIndex("fieldName", "fieldName", { unique: false });
          store.createIndex("objectType", "objectType", { unique: false });
          store.createIndex("searchTerm", "searchTerm", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject("Failed to open IndexedDB");
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  }

  async addFields(fields: CDMField[], onProgress?: (count: number) => void): Promise<void> {
    if (!this.db) await this.init();
    const transaction = this.db!.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    let count = 0;
    for (const field of fields) {
      const doc = {
        ...field,
        searchTerm: `${field.fieldName} ${field.objectType} ${field.description} ${field.label}`.toLowerCase()
      };
      store.put(doc);
      count++;
      if (count % 100 === 0 && onProgress) onProgress(count);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject();
    });
  }

  async searchFields(query: string, limit: number = 50, offset: number = 0): Promise<SearchResult> {
    if (!this.db) await this.init();
    const lowerQuery = query.toLowerCase().trim();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const results: CDMField[] = [];
      let matchedCount = 0;

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value;
          const matches = !lowerQuery || value.searchTerm.includes(lowerQuery);
          
          if (matches) {
            matchedCount++;
            // If the current match falls within the requested page range
            if (matchedCount > offset && results.length < limit) {
              results.push(value);
            }
          }
          cursor.continue();
        } else {
          resolve({
            fields: results,
            total: matchedCount,
            hasMore: matchedCount > (offset + results.length)
          });
        }
      };
    });
  }

  async getCount(): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
    });
  }
}

export const dbService = new DBService();
