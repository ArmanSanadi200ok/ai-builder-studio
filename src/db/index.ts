import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL!)
  : ((..._args: unknown[]) => {
      throw new Error("DATABASE_URL environment variable is not set");
    }) as unknown as ReturnType<typeof neon>;

export const db = drizzle(sql, { schema });
