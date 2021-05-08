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
): WithStore {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(storeName, {
      keyPath: key,
    });
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

export function push<T>(
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
        let lowestKey: number = 0;
        store.openKeyCursor().onsuccess = function () {
          const cursor = this.result;
          if (cursor && total++ < retentionConfig.batchEvictionNumber) {
            lowestKey = cursor.key as number;
            cursor.continue();
          }
        };
        return promisify(store.transaction).then(() => {
          return withStore('readwrite', (store) => {
            store.delete(IDBKeyRange.upperBound(lowestKey));
            return promisify(store.transaction);
          });
        });
      });
    }),
  );
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
