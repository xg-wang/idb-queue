import {
  batchEvict,
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
  WithStore,
} from '../src';

const { expect } = chai;

function generateData(num: number) {
  const res = [];
  for (let i = 0; i < num; i++) {
    res.push({ key: i, value: i });
  }
  return res;
}

describe('push & peek', () => {
  let testStore: WithStore;
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

  it('peek retrieves values', async () => {
    const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    expect(await peek(1, testStore)).deep.equal(
      [data[0]],
      'peek retrieves lowest',
    );
    expect(await peek(2, testStore)).deep.equal(
      [data[0], data[1]],
      'peek retrieves multiple',
    );
    expect(await peekAll(testStore)).deep.equal(data, 'peekAll retrieves all');
    expect(await peekBack(1, testStore)).deep.equal(
      [data[3]],
      'peekBack retrieves highest',
    );
  });

  it('clear() clears the object store', async () => {
    const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    expect(await peekAll(testStore)).deep.equal(data, 'peekAll retrieves all');
    await clear(testStore);
    expect(await peekAll(testStore)).deep.equal(
      [],
      'peekAll retrieves none after clear',
    );
  });

  it('batchEvict evicts data', async () => {
    const retentionConfig = { maxNumber: 10, batchEvictionNumber: 2 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }
    const all = await peekAll(testStore);
    expect(all).deep.equal(data);
    await batchEvict(retentionConfig, testStore);
    expect(await peekAll(testStore)).deep.equal([data[2], data[3]]);
  });
});

describe('shift & pop', () => {
  let testStore: WithStore;
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

  it('shifts lowest data', async () => {
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

  it('pops highest data', async () => {
    const retentionConfig = { maxNumber: 100, batchEvictionNumber: 10 };
    const data = generateData(4);
    for (const d of data) {
      await push(d, retentionConfig, testStore);
    }

    const poped = await pop(1, testStore);
    expect(poped).deep.equal([data[3]]);
    const left = await peekAll(testStore);
    expect(left).deep.equal(data.slice(0, 3));

    const poped2 = await pop(2, testStore);
    expect(poped2).deep.equal([data[2], data[1]]);
    const left2 = await peekAll(testStore);
    expect(left2).deep.equal(data.slice(0, 1));
  });
});
