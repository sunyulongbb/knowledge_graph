import {test,expect} from 'bun:test';
import {parseResetArguments} from '../scripts/reset-default-database';
test('reset previews by default and requires explicit execution',()=>{
 expect(parseResetArguments([]).execute).toBe(false);
 expect(parseResetArguments(['--dry-run']).execute).toBe(false);
 expect(parseResetArguments(['--execute']).execute).toBe(true);
 expect(()=>parseResetArguments(['--execute','--dry-run'])).toThrow();
 expect(()=>parseResetArguments(['--database=other'])).toThrow();
});
