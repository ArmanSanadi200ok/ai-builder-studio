import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : ((...args: any[]) => {
      throw new Error("DATABASE_URL environment variable is not set");
    }) as any;

export const db = drizzle(sql, { schema });
