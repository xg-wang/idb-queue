import {
  promisify,
  createStore,
  push,
  peekAll,
  shift,
  shiftAll,
  UseStore,
} from '../src';

const { expect } = chai;

const startTimestamp = Date.now();

function generateData(num: number) {
  const res = [];
  for (let i = 0; i < num; i++) {
    res.push({ timestamp: startTimestamp + i, value: i });
  }
  return res;
}

describe('Push', () => {
  let testStore: UseStore;
  beforeEach(async () => {
    await promisify(indexedDB.deleteDatabase('test-store'));
    testStore = createStore('test-store', 'beacons');
  });
  afterEach(async () => {
    await promisify(indexedDB.deleteDatabase('test-store'));
  });

  it('should push data into db', async () => {
    const retentionConfig = { maxNumber: 3, batchEvictionNumber: 3 };
    const data = generateData(3);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    const all = await peekAll(testStore);
    expect(all).deep.equal(data);
  });

  it('respects retentionConfig', async () => {
    const retentionConfig = { maxNumber: 3, batchEvictionNumber: 3 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    const all = await peekAll(testStore);
    expect(all).deep.equal([data[3]]);
  });

  it('keeps data sorted by key (timestamp)', async () => {
    const retentionConfig = { maxNumber: 3, batchEvictionNumber: 3 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    const all = await peekAll(testStore);
    expect(all).deep.equal([data[3]]);

    await push(data[0], retentionConfig, testStore);
    await push(data[1], retentionConfig, testStore);
    const all2 = await peekAll(testStore);
    expect(all2).deep.equal([data[0], data[1], data[3]], 'can push data again');
  });
});

describe('Shift', () => {
  let testStore: UseStore;
  beforeEach(async () => {
    await promisify(indexedDB.deleteDatabase('test-store'));
    testStore = createStore('test-store', 'beacons');
  });
  afterEach(async () => {
    await promisify(indexedDB.deleteDatabase('test-store'));
  });

  it('shifts all data with shiftAll', async () => {
    const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    const all = await shiftAll(testStore);
    expect(all).deep.equal(data);
    const left = await peekAll(testStore);
    expect(left).deep.equal([]);
  });

  it('shifts first data with shift', async () => {
    const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }

    const shifted = await shift(1, testStore);
    expect(shifted).deep.equal([data[0]]);
    const left = await peekAll(testStore);
    expect(left).deep.equal(data.slice(1));

    const shifted2 = await shift(2, testStore);
    expect(shifted2).deep.equal([data[1], data[2]]);
    const left2 = await peekAll(testStore);
    expect(left2).deep.equal(data.slice(3));
  });
});
