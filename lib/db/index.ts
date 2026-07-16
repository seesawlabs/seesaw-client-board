import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Lazy singleton: `neon()` throws immediately if DATABASE_URL is unset, which
// would otherwise happen at module-import time (e.g. during `next build`'s
// page-data collection, before any database is provisioned). Deferring the
// connection until the first real query keeps `import`-ing this module safe
// with no DATABASE_URL, while behaving identically once one is set.
let _db: Db | undefined;
function getDb(): Db {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
