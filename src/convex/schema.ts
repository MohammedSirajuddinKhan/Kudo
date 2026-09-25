import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);

/**
 * A single editable region on a certificate template.
 * Coordinates (x, y, width, height) are normalized 0..1 against the page,
 * so they stay correct at any zoom / export resolution.
 * fontSize / letterSpacing are in "template pixels" (the stored page width).
 */
export const certificateField = v.object({
  id: v.string(),
  name: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("date"),
    v.literal("number"),
    v.literal("email"),
    v.literal("certificateId"),
    v.literal("qr"),
  ),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  fontSize: v.number(),
  fontFamily: v.string(),
  fontWeight: v.number(),
  italic: v.boolean(),
  underline: v.boolean(),
  color: v.string(),
  align: v.union(v.literal("left"), v.literal("center"), v.literal("right")),
  vAlign: v.union(v.literal("top"), v.literal("middle"), v.literal("bottom")),
  letterSpacing: v.number(),
  lineHeight: v.number(),
  textTransform: v.union(
    v.literal("none"),
    v.literal("uppercase"),
    v.literal("lowercase"),
    v.literal("capitalize"),
  ),
  autoFit: v.boolean(),
  wrap: v.boolean(),
  required: v.boolean(),
  placeholder: v.optional(v.string()),
  source: v.union(v.literal("ai"), v.literal("manual")),
  confidence: v.optional(v.number()),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ─── Kudo domain tables ────────────────────────────────────────────────

    // A certificate design uploaded by an admin. The original asset is immutable.
    templates: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      status: v.union(v.literal("draft"), v.literal("ready"), v.literal("archived")),
      version: v.number(), // latest version number
      originalStorageId: v.id("_storage"), // never modified, never replaced
      renderStorageId: v.id("_storage"), // image used for rendering (rasterized page 1 for PDFs)
      assetType: v.union(v.literal("image"), v.literal("pdf")),
      assetFileName: v.string(),
      assetWidth: v.number(), // render page width in px
      assetHeight: v.number(), // render page height in px
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_updatedAt", ["updatedAt"])
      .index("by_createdBy", ["createdBy"]),

    // Immutable snapshots of a template's fields. Certificates reference the
    // version they were generated with, so editing a template never changes
    // previously issued certificates.
    templateVersions: defineTable({
      templateId: v.id("templates"),
      version: v.number(),
      fields: v.array(certificateField),
      createdAt: v.number(),
      createdBy: v.id("users"),
    }).index("by_template_version", ["templateId", "version"]),

    // An issued certificate. Values snapshot the field labels at issue time.
    certificates: defineTable({
      certificateId: v.string(), // globally unique, e.g. KUDO-2026-000184
      templateId: v.id("templates"),
      templateName: v.string(), // snapshot for display
      templateVersion: v.number(),
      category: v.optional(v.string()),
      recipientName: v.string(),
      recipientEmail: v.optional(v.string()),
      orgName: v.string(), // issuing organization snapshot
      values: v.array(v.object({ key: v.string(), label: v.string(), value: v.string() })),
      issueDate: v.string(), // ISO date (yyyy-mm-dd)
      expiryDate: v.optional(v.string()), // ISO date, optional expiry support
      status: v.union(v.literal("active"), v.literal("revoked")),
      revokedReason: v.optional(v.string()),
      revokedAt: v.optional(v.number()),
      verifyCount: v.number(),
      batchJobId: v.optional(v.id("bulkJobs")),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_certificateId", ["certificateId"])
      .index("by_createdAt", ["createdAt"])
      .index("by_templateId", ["templateId"])
      .index("by_createdBy", ["createdBy"]),

    // Public verification attempts (append-only trail).
    verificationRecords: defineTable({
      certificateRowId: v.optional(v.id("certificates")),
      certificateId: v.string(),
      method: v.union(v.literal("qr"), v.literal("id"), v.literal("link")),
      result: v.union(
        v.literal("verified"),
        v.literal("not_found"),
        v.literal("revoked"),
        v.literal("expired"),
      ),
      createdAt: v.number(),
    })
      .index("by_certificateRowId", ["certificateRowId"])
      .index("by_createdAt", ["createdAt"]),

    // Append-only audit trail. No update/delete functions are exposed.
    auditLogs: defineTable({
      action: v.string(), // e.g. "template.created"
      actorId: v.optional(v.id("users")),
      actorEmail: v.optional(v.string()),
      resourceType: v.string(),
      resourceId: v.optional(v.string()),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
    }).index("by_createdAt", ["createdAt"]),

    // Bulk generation jobs.
    bulkJobs: defineTable({
      templateId: v.id("templates"),
      templateName: v.string(),
      fileName: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      totalRows: v.number(),
      generatedCount: v.number(),
      failedCount: v.number(),
      createdAt: v.number(),
      createdBy: v.id("users"),
      completedAt: v.optional(v.number()),
    }).index("by_createdAt", ["createdAt"]),

    // One spreadsheet row per certificate, pre-mapped to template field ids.
    bulkRows: defineTable({
      jobId: v.id("bulkJobs"),
      rowIndex: v.number(),
      values: v.record(v.string(), v.string()), // fieldId -> value
      status: v.union(
        v.literal("valid"),
        v.literal("error"),
        v.literal("generated"),
        v.literal("failed"),
      ),
      errors: v.array(v.string()),
      certificateId: v.optional(v.string()),
    }).index("by_job", ["jobId", "rowIndex"]),

    // Deployment-wide settings (single row, key = "global").
    settings: defineTable({
      key: v.string(),
      organizationName: v.string(),
      certificateIdPrefix: v.string(),
      certificateIdPadding: v.number(),
      showQrOnCertificates: v.boolean(),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // Atomic sequence counters (e.g. certificate IDs).
    counters: defineTable({
      key: v.string(),
      value: v.number(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
