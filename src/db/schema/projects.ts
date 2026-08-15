import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

export const projects = pgTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "queued", "generating", "validating", "ready", "deploying", "deployed", "failed"] }).notNull().default("draft"),
  selectedProvider: text("selectedProvider"),
  selectedModel: text("selectedModel"),
  githubRepoUrl: text("githubRepoUrl"),
  vercelDeployUrl: text("vercelDeployUrl"),
  vercelProjectId: text("vercelProjectId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const projectVersions = pgTable("project_version", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  promptUsed: text("promptUsed"),
  versionNumber: integer("versionNumber").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const projectFiles = pgTable("project_file", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  versionId: text("versionId")
    .notNull()
    .references(() => projectVersions.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
