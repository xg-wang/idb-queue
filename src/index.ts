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

export function createStore(dbName: string, storeName: string): UseStore {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => {
    const store = request.result.createObjectStore(storeName, {
      keyPath: 'timestamp',
    });
    store.createIndex('timestamp', 'timestamp', { unique: false });
  };
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });

  return (txMode, callback) =>
    p.then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName)),
    );
}

export type UseStore = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>,
) => Promise<T>;

let defaultStoreFunc: UseStore | undefined;

function defaultStore() {
  if (!defaultStoreFunc) {
    defaultStoreFunc = createStore('beacon-transporter', 'beacons');
  }
  return defaultStoreFunc;
}

export interface RetentionConfig {
  maxNumber: number;
  batchEvictionNumber: number;
  // TODO(maybe): maxMs: number;
}

function defaultRetention(): RetentionConfig {
  return {
    maxNumber: 1000,
    batchEvictionNumber: 300,
  };
}

export interface TimeStamped {
  [K: string]: any;
  timestamp: number;
}

export function push<T extends TimeStamped>(
  value: T,
  retentionConfig = defaultRetention(),
  withStore = defaultStore(),
) {
  return withStore('readwrite', (store) => {
    store.put(value);
    return promisify(store.transaction);
  }).then(() =>
    withStore('readonly', (store) => promisify(store.count())).then((count) => {
      // Delete old entries based on batchEvictionNumber when exceeding maxNumber
      if (count <= retentionConfig.maxNumber) {
        return;
      }
      return withStore('readonly', (store) => {
        let total = 0;
        let oldestTimestamp: number = 0;
        store.openKeyCursor().onsuccess = function () {
          const cursor = this.result;
          if (cursor && total++ < retentionConfig.batchEvictionNumber) {
            oldestTimestamp = cursor.key as number;
            cursor.continue();
          }
        };
        return promisify(store.transaction).then(() => {
          return withStore('readwrite', (store) => {
            store.delete(IDBKeyRange.upperBound(oldestTimestamp));
            return promisify(store.transaction);
          });
        });
      });
    }),
  );
}

export function peek<T extends TimeStamped>(
  count = 1,
  withStore = defaultStore(),
) {
  return withStore('readonly', (store) => {
    let peeked: Array<T> = [];
    store.openCursor().onsuccess = function () {
      const cursor = this.result;
      if (cursor) {
        peeked.push(cursor.value);
        if (count < 0 || peeked.length < count) {
          cursor.continue();
        }
      }
    };
    return promisify<T>(store.transaction).then(() => peeked);
  });
}
export function peekAll<T extends TimeStamped>(withStore = defaultStore()) {
  return peek<T>(-1, withStore);
}

export function shift<T extends TimeStamped>(
  count = 1,
  withStore = defaultStore(),
) {
  return withStore('readwrite', (store) => {
    let shifted: Array<T> = [];
    store.openCursor().onsuccess = function () {
      const cursor = this.result;
      if (cursor) {
        shifted.push(cursor.value);
        cursor.delete();
        if (count < 0 || shifted.length < count) {
          cursor.continue();
        }
      }
    };
    return promisify<T>(store.transaction).then(() => shifted);
  });
}
export function shiftAll<T extends TimeStamped>(withStore = defaultStore()) {
  return shift<T>(-1, withStore);
}
