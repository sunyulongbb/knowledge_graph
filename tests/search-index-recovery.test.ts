import { expect, test } from 'bun:test';
import { withSearchIndexRecovery } from '../src/server/search-index-recovery.ts';

test('missing index is reconciled before retrying the read', async () => {
  let calls=0, repairs=0;
  const result=await withSearchIndexRecovery(async()=>{
    if (++calls===1) throw {status:404,body:{error:{type:'index_not_found_exception'}}};
    expect(repairs).toBe(1);
    return ['knowledge'];
  },async()=>{repairs++;});
  expect(result).toEqual(['knowledge']);
  expect(calls).toBe(2);
});

test('other failures propagate without rebuilding', async()=>{
  let repairs=0;
  const error={status:503};
  await expect(withSearchIndexRecovery(async()=>{throw error;},async()=>{repairs++;})).rejects.toEqual(error);
  expect(repairs).toBe(0);
});
