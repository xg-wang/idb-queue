# idb-queue

[![npm version](https://badge.fury.io/js/idb-queue.svg)](https://badge.fury.io/js/idb-queue)
[![CI](https://github.com/xg-wang/idb-queue/actions/workflows/ci.yml/badge.svg)](https://github.com/xg-wang/idb-queue/actions/workflows/ci.yml)

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
  clear,
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
await clear(withStore);
```

## Credit

Inspired by https://github.com/jakearchibald/idb-keyval
