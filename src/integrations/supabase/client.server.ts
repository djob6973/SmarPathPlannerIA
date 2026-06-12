// Supabase has been replaced with postgres.js (see src/lib/db.ts).
// All database access must go through server functions in src/lib/*.functions.ts.
// This file is kept as a stub so that any accidental import gives a clear error.

const STUB = new Proxy({} as any, {
  get(_target, prop) {
    throw new Error(
      `[Migration] Supabase admin client is no longer available. ` +
      `Attempted to access ".${String(prop)}". ` +
      `Use src/lib/db.ts with getAuthContext() inside a server function instead.`
    );
  },
});

export const supabaseAdmin = STUB;
