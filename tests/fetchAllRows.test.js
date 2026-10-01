import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows } from '../src/hub/lib/fetchAllRows.ts';

function source(data, { serverCap = 1000, count = true, failAt } = {}) {
  const pages = [];
  const create = () => {
    let start; let end; let ordered = false;
    const builder = {
      order(column, options) { assert.equal(column,'id'); assert.equal(options.ascending,true); ordered = true; return builder; },
      range(from,to) { assert.ok(ordered); start=from;end=to; return builder; },
      abortSignal() { return builder; },
      then(resolve,reject) {
        pages.push([start,end]);
        return Promise.resolve(start === failAt ? { data:null,error:{message:'Falha de página'} } : {
          data:data.slice(start,Math.min(end+1,start+serverCap)),error:null,count:count ? data.length : null,
        }).then(resolve,reject);
      },
    };
    return builder;
  };
  return {create,pages};
}

test('fetches histories beyond 1000 records with stable ID ordering and exact ranges', async () => {
  const rows=Array.from({length:1243},(_,id)=>({id})); const fake=source(rows);
  assert.deepEqual(await fetchAllRows(fake.create),rows);
  assert.deepEqual(fake.pages,[[0,499],[500,999],[1000,1499]]);
});
test('a shorter server cap never silently truncates history, including count-less responses', async () => {
  for(const count of [true,false]) {
    const rows=Array.from({length:250},(_,id)=>({id}));const fake=source(rows,{serverCap:100,count});
    assert.deepEqual(await fetchAllRows(fake.create),rows);
    assert.deepEqual(fake.pages.slice(0,3),[[0,499],[100,599],[200,699]]);
  }
});
test('later-page errors fail the whole query instead of presenting partial financial totals', async () => {
  const fake=source(Array.from({length:600},(_,id)=>({id})),{failAt:500});
  await assert.rejects(fetchAllRows(fake.create),error=>error.message==='Falha de página');
});
test('cancellation and invalid page sizes do not start remote requests', async () => {
  const fake=source([]);const controller=new AbortController();controller.abort();
  await assert.rejects(fetchAllRows(fake.create,{signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(fetchAllRows(fake.create,{pageSize:0}));
  assert.equal(fake.pages.length,0);
});
