import { relations } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea"
  }
})

export const fileKind = pgEnum("file_kind", ["file", "directory"])
export const workspaceRole = pgEnum("workspace_role", ["owner", "editor", "viewer"])
export const containerStatus = pgEnum("container_status", [
  "pending",
  "starting",
  "running",
  "stopped",
  "error"
])

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
})

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    imageId: text("image_id").notNull(),
    imageRef: text("image_ref").notNull(),
    containerId: text("container_id"),
    containerStatus: containerStatus("container_status").default("pending").notNull(),
    containerError: text("container_error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIdx: index("workspaces_owner_idx").on(table.ownerId)
  })
)

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: workspaceRole("role").default("viewer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
    userIdx: index("workspace_members_user_idx").on(table.userId)
  })
)

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    kind: fileKind("kind").notNull(),
    language: text("language"),
    content: text("content").default("").notNull(),
    readonly: boolean("readonly").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workspacePathUnique: uniqueIndex("files_workspace_path_unique").on(table.workspaceId, table.path),
    workspaceIdx: index("files_workspace_idx").on(table.workspaceId)
  })
)

export const collabDocuments = pgTable(
  "collab_documents",
  {
    name: text("name").primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }),
    state: bytea("state").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    fileIdx: index("collab_documents_file_idx").on(table.fileId)
  })
)

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  files: many(files)
}))

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id]
  })
}))

export const filesRelations = relations(files, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [files.workspaceId],
    references: [workspaces.id]
  })
}))
