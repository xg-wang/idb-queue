export function promisify<T = undefined>(
  request: IDBRequest<T> | IDBTransaction,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // @ts-ignore - file size hacks
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    // @ts-ignore - file size hacks
    request.onabort = request.onerror = () => reject(request.error);
  });
}

export function createStore(
  dbName: string,
  storeName: string,
  key = 'key',
  options?: {
    onSuccess: () => void;
    onError: (e: unknown) => void;
  },
): WithStore {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => {
    try {
      request.result.createObjectStore(storeName, {
        keyPath: key,
      });
    } catch (error) {
      options?.onError(error);
    }
  };
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
      options?.onSuccess();
    };
    request.onerror = () => {
      reject(request.error);
      options?.onError(request.error);
    };
  });

  return (txMode, callback) =>
    p.then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName)),
    );
}

export type WithStore = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>,
) => Promise<T>;

let defaultStoreFunc: WithStore | undefined;
function defaultStore() {
  if (!defaultStoreFunc) {
    defaultStoreFunc = createStore('idb-queue', 'default');
  }
  return defaultStoreFunc;
}

export interface RetentionConfig {
  maxNumber: number;
  batchEvictionNumber: number;
}
function defaultRetention(): RetentionConfig {
  return {
    maxNumber: 1000,
    batchEvictionNumber: 300,
  };
}

function _batchEvictFromStoreTx(
  store: IDBObjectStore,
  retentionConfig = defaultRetention(),
): Promise<void> {
  let total = 0;
  let lowestKey: number | null = null;
  store.openKeyCursor().onsuccess = function () {
    const cursor = this.result;
    if (cursor && total++ < retentionConfig.batchEvictionNumber) {
      lowestKey = cursor.key as number;
      cursor.continue();
    } else if (lowestKey != null) {
      store.delete(IDBKeyRange.upperBound(lowestKey));
    }
  };
  return promisify(store.transaction);
}

export function batchEvict(
  retentionConfig = defaultRetention(),
  withStore = defaultStore(),
) {
  return withStore('readwrite', (store) =>
    _batchEvictFromStoreTx(store, retentionConfig),
  );
}

let isClearing = false;

export function push<T>(
  value: T,
  retentionConfig = defaultRetention(),
  withStore = defaultStore(),
): Promise<void> {
  return withStore('readwrite', (store) => {
    store.put(value);
    return promisify(store.count()).then((count) => {
      // Delete old entries based on batchEvictionNumber when exceeding maxNumber
      if (count <= retentionConfig.maxNumber) {
        return;
      }
      return _batchEvictFromStoreTx(store, retentionConfig);
    });
  }).catch((reason) => {
    if (reason && reason.name === 'QuotaExceededError') {
      return batchEvict(retentionConfig, withStore);
    }
  });
}

export function pushIfNotClearing<T>(
  value: T,
  retentionConfig = defaultRetention(),
  withStore = defaultStore(),
): Promise<void> {
  return isClearing
    ? Promise.resolve()
    : push(value, retentionConfig, withStore);
}

export function clear(withStore = defaultStore()) {
  isClearing = true;
  return withStore('readwrite', (store) => {
    store.clear();
    return promisify(store.transaction).finally(() => (isClearing = false));
  });
}

export function _shift<T>(
  count: number,
  withStore: WithStore,
  direction: IDBCursorDirection,
) {
  return withStore('readwrite', (store) => {
    let shifted: Array<T> = [];
    store.openCursor(null, direction).onsuccess = function () {
      const cursor = this.result;
      if (cursor) {
        shifted.push(cursor.value);
        cursor.delete();
        if (count < 0 || shifted.length < count) {
          cursor.continue();
        }
      }
    };
    return promisify(store.transaction).then(() => shifted);
  });
}

function _peek<T>(
  count: number,
  withStore: WithStore,
  direction: IDBCursorDirection,
) {
  return withStore('readonly', (store) => {
    let peeked: Array<T> = [];
    store.openCursor(null, direction).onsuccess = function () {
      const cursor = this.result;
      if (cursor) {
        peeked.push(cursor.value);
        if (count < 0 || peeked.length < count) {
          cursor.continue();
        }
      }
    };
    return promisify(store.transaction).then(() => peeked);
  });
}

export function peek<T>(count = 1, withStore = defaultStore()) {
  return _peek<T>(count, withStore, 'next');
}
export function peekAll<T>(withStore = defaultStore()) {
  return _peek<T>(-1, withStore, 'next');
}

export function shift<T>(count = 1, withStore = defaultStore()) {
  return _shift<T>(count, withStore, 'next');
}

export function shiftAll<T>(withStore = defaultStore()) {
  return shift<T>(-1, withStore);
}

export function peekBack<T>(count = 1, withStore = defaultStore()) {
  return _peek<T>(count, withStore, 'prev');
}

export function pop<T>(count = 1, withStore = defaultStore()) {
  return _shift<T>(count, withStore, 'prev');
}
