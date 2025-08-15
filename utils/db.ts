import { Notes } from '../types';

const DB_NAME = 'VoiceNotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

export interface NoteRecord {
  id: string;
  createdAt: Date;
  notes: Notes;
  audioBlob: Blob;
}

let db: IDBDatabase;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('IndexedDB error');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = () => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addNote = async (note: NoteRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    
    transaction.oncomplete = () => {
      resolve();
    };
    
    transaction.onerror = () => {
      console.error('Transaction error adding note:', transaction.error);
      reject(transaction.error);
    };

    const store = transaction.objectStore(STORE_NAME);
    store.add(note);
  });
};

export const getAllNotesMeta = async (): Promise<{ id: string; title: string; createdAt: Date }[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const result: NoteRecord[] = request.result;
            // Sort by newest first
            result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            // Map to metadata to avoid loading blobs into memory
            const meta = result.map(item => ({
                id: item.id,
                title: item.notes.title,
                createdAt: item.createdAt,
            }));
            resolve(meta);
        };
        request.onerror = () => {
            console.error('Error getting all notes:', request.error);
            reject(request.error);
        };
    });
};

export const getNote = async (id: string): Promise<NoteRecord | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.error('Error getting note:', request.error);
            reject(request.error);
        };
    });
}

export const deleteNote = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            console.error('Transaction error deleting note:', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);
    });
};