import { pgTable, text } from "drizzle-orm/pg-core";
import { users } from "./users";

export const githubConnections = pgTable("github_connection", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  encryptedToken: text("encryptedToken").notNull(),
  iv: text("iv").notNull(),
});

export const vercelConnections = pgTable("vercel_connection", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  encryptedToken: text("encryptedToken").notNull(),
  iv: text("iv").notNull(),
});
