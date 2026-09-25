import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireUser, getSettings, logAudit } from "./kudo";

/** Internal (server-only) template fetch used by actions like AI analysis. */
export const getTemplateInternal = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const templates = await ctx.db.query("templates").withIndex("by_updatedAt").order("desc").collect();
    const out = [];
    for (const t of templates) {
      const certs = await ctx.db
        .query("certificates")
        .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
        .collect();
      const version = await ctx.db
        .query("templateVersions")
        .withIndex("by_template_version", (q) => q.eq("templateId", t._id).eq("version", t.version))
        .unique();
      out.push({
        ...t,
        certificateCount: certs.length,
        renderUrl: await ctx.storage.getUrl(t.renderStorageId),
        fields: version?.fields ?? [],
      });
    }
    return out;
  },
});

export const getTemplate = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const t = await ctx.db.get(args.id);
    if (!t) return null;
    const version = await ctx.db
      .query("templateVersions")
      .withIndex("by_template_version", (q) => q.eq("templateId", args.id).eq("version", t.version))
      .unique();
    const url = await ctx.storage.getUrl(t.renderStorageId);
    const originalUrl = await ctx.storage.getUrl(t.originalStorageId);
    return { ...t, fields: version?.fields ?? [], renderUrl: url, originalUrl };
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    originalStorageId: v.id("_storage"),
    renderStorageId: v.id("_storage"),
    assetType: v.union(v.literal("image"), v.literal("pdf")),
    assetFileName: v.string(),
    assetWidth: v.number(),
    assetHeight: v.number(),
    fields: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const templateId = await ctx.db.insert("templates", {
      name: args.name,
      description: args.description,
      category: args.category,
      status: "ready",
      version: 1,
      originalStorageId: args.originalStorageId,
      renderStorageId: args.renderStorageId,
      assetType: args.assetType,
      assetFileName: args.assetFileName,
      assetWidth: args.assetWidth,
      assetHeight: args.assetHeight,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
    });
    await ctx.db.insert("templateVersions", {
      templateId,
      version: 1,
      fields: args.fields,
      createdAt: now,
      createdBy: user._id,
    });
    await logAudit(ctx, {
      action: "template.created",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "template",
      resourceId: templateId,
      metadata: { name: args.name, category: args.category, fields: args.fields.length },
    });
    return templateId;
  },
});

export const saveTemplateFields = mutation({
  args: {
    templateId: v.id("templates"),
    fields: v.array(
      v.object({
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
      }),
    ),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found.");
    const now = Date.now();
    const existing = await ctx.db
      .query("templateVersions")
      .withIndex("by_template_version", (q) =>
        q.eq("templateId", args.templateId).eq("version", template.version),
      )
      .unique();
    const sameAsCurrent =
      existing && JSON.stringify(existing.fields) === JSON.stringify(args.fields);
    let version = template.version;
    if (!sameAsCurrent && existing) {
      version = template.version + 1;
      await ctx.db.insert("templateVersions", {
        templateId: args.templateId,
        version,
        fields: args.fields,
        createdAt: now,
        createdBy: user._id,
      });
      await logAudit(ctx, {
        action: "template.edited",
        actorId: user._id,
        actorEmail: user.email,
        resourceType: "template",
        resourceId: args.templateId,
        metadata: { newVersion: version, fields: args.fields.length },
      });
    }
    await ctx.db.patch(args.templateId, {
      name: args.name ?? template.name,
      description: args.description ?? template.description,
      category: args.category ?? template.category,
      version,
      status: "ready",
      updatedAt: now,
    });
    return version;
  },
});

export const duplicateTemplate = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found.");
    const version = await ctx.db
      .query("templateVersions")
      .withIndex("by_template_version", (q) =>
        q.eq("templateId", args.templateId).eq("version", template.version),
      )
      .unique();
    const now = Date.now();
    const newId = await ctx.db.insert("templates", {
      name: `${template.name} (copy)`,
      description: template.description,
      category: template.category,
      status: "ready",
      version: 1,
      originalStorageId: template.originalStorageId,
      renderStorageId: template.renderStorageId,
      assetType: template.assetType,
      assetFileName: template.assetFileName,
      assetWidth: template.assetWidth,
      assetHeight: template.assetHeight,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
    });
    await ctx.db.insert("templateVersions", {
      templateId: newId,
      version: 1,
      fields: version?.fields ?? [],
      createdAt: now,
      createdBy: user._id,
    });
    await logAudit(ctx, {
      action: "template.duplicated",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "template",
      resourceId: newId,
      metadata: { from: args.templateId },
    });
    return newId;
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found.");
    const certs = await ctx.db
      .query("certificates")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .collect();
    if (certs.length > 0) {
      await ctx.db.patch(args.templateId, { status: "archived", updatedAt: Date.now() });
      await logAudit(ctx, {
        action: "template.archived",
        actorId: user._id,
        actorEmail: user.email,
        resourceType: "template",
        resourceId: args.templateId,
        metadata: { certificates: certs.length },
      });
      return "archived";
    }
    const versions = await ctx.db
      .query("templateVersions")
      .withIndex("by_template_version", (q) => q.eq("templateId", args.templateId))
      .collect();
    for (const v of versions) await ctx.db.delete(v._id);
    await ctx.db.delete(args.templateId);
    await logAudit(ctx, {
      action: "template.deleted",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "template",
      resourceId: args.templateId,
      metadata: { name: template.name },
    });
    return "deleted";
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const templates = await ctx.db.query("templates").collect();
    const set = new Set<string>();
    for (const t of templates) set.add(t.category);
    return Array.from(set).sort();
  },
});

export const getSettingsQuery = query({
  args: {},
  handler: async (ctx) => {
    return await getSettings(ctx);
  },
});
