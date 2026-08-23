/**
 * db.js
 * Handles IndexedDB operations for storing notes locally.
 */
export class Database {
    constructor(dbName = 'NexusDB') {
        this.dbName = dbName;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('notes')) {
                    // Title is unique, we use it as the primary key since it's a wiki-style system
                    db.createObjectStore('notes', { keyPath: 'title' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getAllNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getNote(title) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.get(title);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveNote(note) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            note.updatedAt = Date.now();
            if (!note.createdAt) note.createdAt = Date.now();
            
            const request = store.put(note);

            request.onsuccess = () => resolve(note);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteNote(title) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.delete(title);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
