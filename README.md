# IDB-TimeSeries

## Installation

```sh
npm install idb-timeseries
```

## Usage

WIP

```javascript
import {
  promisify,
  createStore,
  push,
  peekAll,
  shift,
  shiftAll,
  UseStore,
} from 'idb-timeseries';

const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
const data = { timestamp: Date.now(), value: {} };

await push(data, retentionConfig);
const shifted = await shift(1);
```

## Credit

Inspired by https://github.com/jakearchibald/idb-keyval
