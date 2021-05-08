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
  WithStore,
} from 'idb-queue';

const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
const data = { timestamp: Date.now(), value: {} };

await push(data, retentionConfig);
const shifted = await shift();
```

## Credit

Inspired by https://github.com/jakearchibald/idb-keyval
