import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb(): D1Database {
  return (getCloudflareContext() as any).env.DB;
}
