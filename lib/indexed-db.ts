// IndexedDB utility for storing history with images
const DB_NAME = "llm-api-test-db"
const DB_VERSION = 2 // 升级版本以添加响应图片存储
const HISTORY_STORE = "history"
const SETTINGS_STORE = "settings"
const RESPONSE_IMAGES_STORE = "responseImages" // 存储响应中的图片

interface HistoryItem {
  id: string
  timestamp: number
  duration?: number
  model: string
  requestContent: string
  requestRaw: string
  responseContent: string
  responseRaw: string
}

interface MessageImage {
  id: string
  type: "url" | "file"
  url?: string
  base64?: string
  mimeType?: string
  name?: string
}

// Initialize IndexedDB
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create history store if it doesn't exist
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: "id" })
        historyStore.createIndex("timestamp", "timestamp", { unique: false })
      }

      // Create settings store if it doesn't exist
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" })
      }

      // Create response images store if it doesn't exist
      if (!db.objectStoreNames.contains(RESPONSE_IMAGES_STORE)) {
        const responseImagesStore = db.createObjectStore(RESPONSE_IMAGES_STORE, { keyPath: "historyTimestamp" })
        responseImagesStore.createIndex("timestamp", "historyTimestamp", { unique: true })
      }
    }
  })
}

// Save history to IndexedDB
export const saveHistoryToDB = async (history: HistoryItem[]): Promise<void> => {
  const db = await initDB()
  const transaction = db.transaction([HISTORY_STORE], "readwrite")
  const store = transaction.objectStore(HISTORY_STORE)

  // Clear existing history
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear()
    clearRequest.onsuccess = () => resolve()
    clearRequest.onerror = () => reject(clearRequest.error)
  })

  // Add all history items
  for (const item of history) {
    await new Promise<void>((resolve, reject) => {
      const addRequest = store.add(item)
      addRequest.onsuccess = () => resolve()
      addRequest.onerror = () => reject(addRequest.error)
    })
  }

  db.close()
}

// Load history from IndexedDB
export const loadHistoryFromDB = async (): Promise<HistoryItem[]> => {
  const db = await initDB()
  const transaction = db.transaction([HISTORY_STORE], "readonly")
  const store = transaction.objectStore(HISTORY_STORE)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const history = request.result as HistoryItem[]
      // Sort by timestamp descending (newest first)
      history.sort((a, b) => b.timestamp - a.timestamp)
      resolve(history)
      db.close()
    }
    request.onerror = () => {
      reject(request.error)
      db.close()
    }
  })
}

// Save images to settings store in IndexedDB
export const saveImagesToDB = async (images: MessageImage[]): Promise<void> => {
  const db = await initDB()
  const transaction = db.transaction([SETTINGS_STORE], "readwrite")
  const store = transaction.objectStore(SETTINGS_STORE)

  return new Promise((resolve, reject) => {
    const request = store.put({ key: "messageImages", value: images })
    request.onsuccess = () => {
      resolve()
      db.close()
    }
    request.onerror = () => {
      reject(request.error)
      db.close()
    }
  })
}

// Load images from IndexedDB
export const loadImagesFromDB = async (): Promise<MessageImage[]> => {
  const db = await initDB()
  const transaction = db.transaction([SETTINGS_STORE], "readonly")
  const store = transaction.objectStore(SETTINGS_STORE)

  return new Promise((resolve, reject) => {
    const request = store.get("messageImages")
    request.onsuccess = () => {
      const result = request.result
      resolve(result?.value || [])
      db.close()
    }
    request.onerror = () => {
      reject(request.error)
      db.close()
    }
  })
}

export const loadImagesToDB = loadImagesFromDB

// Migrate from localStorage to IndexedDB
export const migrateFromLocalStorage = async (): Promise<void> => {
  try {
    // Check if migration has already been done
    const migrationFlag = localStorage.getItem("indexeddb_migration_complete")
    if (migrationFlag === "true") {
      return
    }

    // Migrate history
    const savedHistory = localStorage.getItem("llm_api_history")
    if (savedHistory) {
      const history = JSON.parse(savedHistory) as HistoryItem[]
      await saveHistoryToDB(history)
      console.log("[v0] Migrated history to IndexedDB")
    }

    // Check for images in settings
    const savedSettings = localStorage.getItem("llm-api-test-settings")
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      if (settings.messageImages && Array.isArray(settings.messageImages)) {
        await saveImagesToDB(settings.messageImages)
        console.log("[v0] Migrated images to IndexedDB")
      }
    }

    // Mark migration as complete
    localStorage.setItem("indexeddb_migration_complete", "true")

    // Clean up old localStorage data
    localStorage.removeItem("llm_api_history")
    console.log("[v0] Migration complete, cleaned up localStorage")
  } catch (error) {
    console.error("[v0] Error during migration:", error)
  }
}

// Save response images to IndexedDB (associated with history timestamp)
export const saveResponseImagesToDB = async (historyTimestamp: number, images: MessageImage[]): Promise<void> => {
  const db = await initDB()
  const transaction = db.transaction([RESPONSE_IMAGES_STORE], "readwrite")
  const store = transaction.objectStore(RESPONSE_IMAGES_STORE)

  return new Promise((resolve, reject) => {
    const request = store.put({ historyTimestamp, images })
    request.onsuccess = () => {
      resolve()
      db.close()
    }
    request.onerror = () => {
      reject(request.error)
      db.close()
    }
  })
}

// Load response images from IndexedDB
export const loadResponseImagesFromDB = async (historyTimestamp: number): Promise<MessageImage[]> => {
  const db = await initDB()
  const transaction = db.transaction([RESPONSE_IMAGES_STORE], "readonly")
  const store = transaction.objectStore(RESPONSE_IMAGES_STORE)

  return new Promise((resolve, reject) => {
    const request = store.get(historyTimestamp)
    request.onsuccess = () => {
      const result = request.result
      resolve(result?.images || [])
      db.close()
    }
    request.onerror = () => {
      reject(request.error)
      db.close()
    }
  })
}

// Delete response images from IndexedDB
export const deleteResponseImagesFromDB = async (historyTimestamp: number): Promise<void> => {
  const db = await initDB()
  const transaction = db.transaction([RESPONSE_IMAGES_STORE], "readwrite")
  const store = transaction.objectStore(RESPONSE_IMAGES_STORE)

  return new Promise((resolve, reject) => {
    const request = store.delete(historyTimestamp)
    request.onsuccess = () => {
      resolve()
      db.close()
    }
    request.onerror = () => {
      reject(request.error)
      db.close()
    }
  })
}

// Clear all data from IndexedDB
export const clearAllData = async (): Promise<void> => {
  const db = await initDB()

  // Clear history
  const historyTransaction = db.transaction([HISTORY_STORE], "readwrite")
  const historyStore = historyTransaction.objectStore(HISTORY_STORE)
  await new Promise<void>((resolve, reject) => {
    const request = historyStore.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  // Clear settings
  const settingsTransaction = db.transaction([SETTINGS_STORE], "readwrite")
  const settingsStore = settingsTransaction.objectStore(SETTINGS_STORE)
  await new Promise<void>((resolve, reject) => {
    const request = settingsStore.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  // Clear response images
  const responseImagesTransaction = db.transaction([RESPONSE_IMAGES_STORE], "readwrite")
  const responseImagesStore = responseImagesTransaction.objectStore(RESPONSE_IMAGES_STORE)
  await new Promise<void>((resolve, reject) => {
    const request = responseImagesStore.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}
