/**
 * Uploaded pictures, kept in IndexedDB.
 *
 * They are far too big for localStorage (where the spec lives), so the spec
 * only carries a key and the bytes live here, keyed the same way. Prune drops
 * the blobs whose layers have gone, so removing a shot does not leave its
 * picture behind forever.
 */
const DB_NAME = "ssg";
const STORE = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putImage(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getImage(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export type ImageAction = { id: string; kind: "load"; key: string } | { id: string; kind: "clear" };

/**
 * What the engine must do to match its loaded shot textures to the scene.
 *
 * `loaded` maps a layer id to the image key currently on it ("" = the demo).
 * Returns a load for every shot whose key changed, and a clear for a shot whose
 * key went empty or that has left the scene — so undo, reset and remove drop an
 * uploaded picture rather than stranding it on the canvas or leaking its
 * texture. Pure, so the revert rule can be checked without a GPU.
 */
export function imageActions(
  loaded: Map<string, string>,
  layers: readonly { id: string; imageKey: string }[],
): ImageAction[] {
  const present = new Set(layers.map((l) => l.id));
  const actions: ImageAction[] = [];
  for (const layer of layers) {
    if ((loaded.get(layer.id) ?? "") === layer.imageKey) continue;
    actions.push(layer.imageKey ? { id: layer.id, kind: "load", key: layer.imageKey } : { id: layer.id, kind: "clear" });
  }
  for (const [id, key] of loaded) {
    if (key && !present.has(id)) actions.push({ id, kind: "clear" });
  }
  return actions;
}

/** Delete every stored image whose key is not in `keep` — the orphans of removed shots. */
export async function pruneImages(keep: Set<string>): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        for (const key of keys.result) {
          if (!keep.has(String(key))) store.delete(key);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
