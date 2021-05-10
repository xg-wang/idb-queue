# idb-queue

## Installation

```sh
npm install idb-queue
```

## Usage

WIP

```javascript
import {
  promisify,
  createStore,
  push,
  peek,
  peekAll,
  peekBack,
  pop,
  shift,
  shiftAll,
} from 'idb-queue';

const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
const data = { key: Date.now(), value: {} };

await push(data, retentionConfig);
const shifted = await shift();

// Create your own store and key
const withStore = createStore('<dbName>', '<storeName>', '<key-can-be-sorted>');
const data = { '<key-can-be-sorted>': 1, value: {} };

await push(data, retentionConfig, withStore);
const shifted = await shift(1, withStore);
```

## Credit

Inspired by https://github.com/jakearchibald/idb-keyval
