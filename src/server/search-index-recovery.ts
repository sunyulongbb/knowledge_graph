/** Retry once after rebuilding a missing index from authoritative knowledge. */
export async function withSearchIndexRecovery<T>(read: () => Promise<T>, repair: () => Promise<unknown>): Promise<T> {
  try { return await read(); }
  catch (error: any) {
    if (error.status !== 404 || error.body?.error?.type !== 'index_not_found_exception') throw error;
    await repair();
    return read();
  }
}
