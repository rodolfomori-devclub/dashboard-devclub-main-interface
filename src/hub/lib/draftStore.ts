import { DRAFT_PREFIX } from './storage';
/**
 * Anti-Data-Loss: Local draft persistence layer.
 * Stores unsaved form data in localStorage, scoped by userId + formKey.
 * Drafts survive page refresh and are cleared only after confirmed DB save.
 */

const PREFIX = DRAFT_PREFIX;

function buildKey(userId: string, formKey: string): string {
  return `${PREFIX}${userId}_${formKey}`;
}

export interface Draft<T = any> {
  data: T;
  timestamp: number;
  synced: boolean;
}

export const draftStore = {
  save<T>(userId: string, formKey: string, data: T): void {
    try {
      const draft: Draft<T> = { data, timestamp: Date.now(), synced: false };
      localStorage.setItem(buildKey(userId, formKey), JSON.stringify(draft));
    } catch {
      // localStorage full or unavailable — fail silently
    }
  },

  load<T>(userId: string, formKey: string): Draft<T> | null {
    try {
      const raw = localStorage.getItem(buildKey(userId, formKey));
      if (!raw) return null;
      return JSON.parse(raw) as Draft<T>;
    } catch {
      return null;
    }
  },

  markSynced(userId: string, formKey: string): void {
    try {
      const raw = localStorage.getItem(buildKey(userId, formKey));
      if (!raw) return;
      const draft = JSON.parse(raw);
      draft.synced = true;
      localStorage.setItem(buildKey(userId, formKey), JSON.stringify(draft));
    } catch {
      // ignore
    }
  },

  clear(userId: string, formKey: string): void {
    try {
      localStorage.removeItem(buildKey(userId, formKey));
    } catch {
      // ignore
    }
  },

  /** Get all unsynced drafts for a user */
  getUnsyncedKeys(userId: string): string[] {
    const keys: string[] = [];
    try {
      const prefix = `${PREFIX}${userId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const draft = JSON.parse(raw);
            if (!draft.synced) {
              keys.push(key.replace(prefix, ''));
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return keys;
  },

  /** Clear all drafts for a user */
  clearAll(userId: string): void {
    try {
      const prefix = `${PREFIX}${userId}_`;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  },
};
