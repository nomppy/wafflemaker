import { getRequestContext } from "@cloudflare/next-on-pages";

export function getDb(): D1Database {
  return getRequestContext().env.DB;
}
