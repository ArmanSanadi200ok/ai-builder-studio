import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userSettings = pgTable("user_settings", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  defaultProvider: text("defaultProvider").default("openai").notNull(),
  defaultModel: text("defaultModel").default("gpt-4o").notNull(),
  ollamaEndpoint: text("ollamaEndpoint").default("http://localhost:11434"),
  aiFallbacks: jsonb("aiFallbacks").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const userIntegrations = pgTable("user_integration", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'github_integration', 'vercel'
  providerAccountId: text("providerAccountId").notNull(),
  encryptedAccessToken: text("encryptedAccessToken").notNull(),
  accessIv: text("accessIv").notNull(),
  encryptedRefreshToken: text("encryptedRefreshToken"),
  refreshIv: text("refreshIv"),
  expiresAt: timestamp("expiresAt", { mode: "date" }),
  scopes: text("scopes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
