/**
 * conversationStore.ts — the conversation survives a reload.
 *
 * History was fresh React state on every mount. Refresh the tab, close the
 * headset, come back tomorrow, and the companion has never met you. That is the
 * single biggest gap between "a talking avatar" and "a companion", and it does
 * not need CI-Server to fix: the browser can remember its own conversation.
 *
 * IndexedDB rather than localStorage because transcripts grow past the ~5 MB
 * string quota, and because writing on every turn from the main thread is
 * exactly the pattern localStorage is worst at.
 */

export interface StoredMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** Epoch ms. */
  at: number
}

const DB_NAME = 'ci-avatar'
const DB_VERSION = 1
const STORE = 'conversation'

/** How many messages to keep on disk. Trimming happens on write. */
const MAX_STORED = 500

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      // Private browsing and some embedded webviews reject this outright.
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    // Persistence is a convenience, never a precondition for talking.
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise<T | null>((resolve) => {
    let request: IDBRequest
    try {
      request = fn(db.transaction(STORE, mode).objectStore(STORE))
    } catch {
      resolve(null)
      return
    }
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => resolve(null)
  })
}

/** Append one message. Never throws; a failed write costs history, not the turn. */
export async function appendMessage(message: StoredMessage): Promise<void> {
  await withStore('readwrite', (store) => store.add(message))
  void trim()
}

/** Load the stored conversation, oldest first. */
export async function loadConversation(): Promise<StoredMessage[]> {
  const all = await withStore<StoredMessage[]>('readonly', (store) => store.getAll())
  return Array.isArray(all) ? all : []
}

export async function clearConversation(): Promise<void> {
  await withStore('readwrite', (store) => store.clear())
}

/**
 * Keep the store bounded.
 *
 * An unbounded transcript is a slow leak that only shows up for the users who
 * like the product most — the ones who talk to it every day.
 */
async function trim(): Promise<void> {
  const db = await openDb()
  if (!db) return
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
  const countRequest = store.count()
  countRequest.onsuccess = () => {
    const excess = countRequest.result - MAX_STORED
    if (excess <= 0) return
    let removed = 0
    const cursorRequest = store.openCursor()
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor || removed >= excess) return
      cursor.delete()
      removed++
      cursor.continue()
    }
  }
}
