import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

export const messages = pgTable("message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const generationRuns = pgTable("generation_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["queued", "running", "validating", "completed", "failed"] }).notNull().default("queued"),
  userPrompt: text("userPrompt").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  tokensUsed: integer("tokensUsed").default(0),
  errorLog: text("errorLog"),
  retryCount: integer("retryCount").default(0).notNull(),
  startedAt: timestamp("startedAt", { mode: "date" }),
  completedAt: timestamp("completedAt", { mode: "date" }),
});
