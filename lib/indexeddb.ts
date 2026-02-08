export interface ContentCache {
    id: string; // Format: "{moduleId}_{subModuleId || 'opening'}"
    moduleId: number;
    subModuleId: number | null;
    content: string;
    timestamp: number;
}

export interface Module {
    title: string;
    subModules: string[];
}

export interface ModuleHeadingsCache {
    id: string; // "learning_path_v1"
    modules: Module[];
    timestamp: number;
}

const DB_NAME = "AtlasContentDB";
const DB_VERSION = 2; // Incremented for new object store
const CONTENT_STORE = "content";
const HEADINGS_STORE = "moduleHeadings";

let dbInstance: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
    if (dbInstance) {
        return dbInstance;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error("Failed to open IndexedDB"));
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(CONTENT_STORE)) {
                const objectStore = db.createObjectStore(CONTENT_STORE, { keyPath: "id" });
                objectStore.createIndex("moduleId", "moduleId", { unique: false });
                objectStore.createIndex("timestamp", "timestamp", { unique: false });
            }

            // Create module headings store
            if (!db.objectStoreNames.contains(HEADINGS_STORE)) {
                const headingsStore = db.createObjectStore(HEADINGS_STORE, { keyPath: "id" });
                headingsStore.createIndex("timestamp", "timestamp", { unique: false });
            }
        };
    });
}

export async function saveContent(cache: ContentCache): Promise<void> {
    try {
        const db = await initDB();
        const transaction = db.transaction([CONTENT_STORE], "readwrite");
        const store = transaction.objectStore(CONTENT_STORE);

        return new Promise((resolve, reject) => {
            const request = store.put(cache);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error("Failed to save content"));
        });
    } catch (error) {
        console.error("Error saving content to IndexedDB:", error);
        throw error;
    }
}

export async function getContent(
    moduleId: number,
    subModuleId?: number
): Promise<string | null> {
    try {
        const db = await initDB();
        const transaction = db.transaction([CONTENT_STORE], "readonly");
        const store = transaction.objectStore(CONTENT_STORE);

        const id = `${moduleId}_${subModuleId ?? "opening"}`;

        return new Promise((resolve, reject) => {
            const request = store.get(id);

            request.onsuccess = () => {
                const result = request.result as ContentCache | undefined;
                resolve(result ? result.content : null);
            };

            request.onerror = () => reject(new Error("Failed to get content"));
        });
    } catch (error) {
        console.error("Error getting content from IndexedDB:", error);
        return null;
    }
}

export async function clearAllContent(): Promise<void> {
    try {
        const db = await initDB();
        const transaction = db.transaction([CONTENT_STORE], "readwrite");
        const store = transaction.objectStore(CONTENT_STORE);

        return new Promise((resolve, reject) => {
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error("Failed to clear content"));
        });
    } catch (error) {
        console.error("Error clearing IndexedDB:", error);
        throw error;
    }
}

export async function getAllContent(): Promise<ContentCache[]> {
    try {
        const db = await initDB();
        const transaction = db.transaction([CONTENT_STORE], "readonly");
        const store = transaction.objectStore(CONTENT_STORE);

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result as ContentCache[]);
            };

            request.onerror = () => reject(new Error("Failed to get all content"));
        });
    } catch (error) {
        console.error("Error getting all content from IndexedDB:", error);
        return [];
    }
}

// Module Headings Functions
export async function saveModuleHeadings(modules: Module[]): Promise<void> {
    try {
        const db = await initDB();
        const transaction = db.transaction([HEADINGS_STORE], "readwrite");
        const store = transaction.objectStore(HEADINGS_STORE);

        const cache: ModuleHeadingsCache = {
            id: "learning_path_v1",
            modules,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(cache);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error("Failed to save module headings"));
        });
    } catch (error) {
        console.error("Error saving module headings to IndexedDB:", error);
        throw error;
    }
}

export async function getModuleHeadings(): Promise<Module[] | null> {
    try {
        const db = await initDB();
        const transaction = db.transaction([HEADINGS_STORE], "readonly");
        const store = transaction.objectStore(HEADINGS_STORE);

        return new Promise((resolve, reject) => {
            const request = store.get("learning_path_v1");

            request.onsuccess = () => {
                const result = request.result as ModuleHeadingsCache | undefined;
                resolve(result ? result.modules : null);
            };

            request.onerror = () => reject(new Error("Failed to get module headings"));
        });
    } catch (error) {
        console.error("Error getting module headings from IndexedDB:", error);
        return null;
    }
}
