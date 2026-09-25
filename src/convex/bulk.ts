import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser, getSettings, logAudit } from "./kudo";

export const createJob = mutation({
  args: {
    templateId: v.id("templates"),
    templateName: v.string(),
    fileName: v.optional(v.string()),
    rows: v.array(
      v.object({
        rowIndex: v.number(),
        values: v.record(v.string(), v.string()),
        status: v.union(v.literal("valid"), v.literal("error")),
        errors: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found.");
    const now = Date.now();
    const jobId = await ctx.db.insert("bulkJobs", {
      templateId: args.templateId,
      templateName: args.templateName,
      fileName: args.fileName,
      status: "draft",
      totalRows: args.rows.length,
      generatedCount: 0,
      failedCount: 0,
      createdAt: now,
      createdBy: user._id,
    });
    const rowIds: string[] = [];
    for (const row of args.rows) {
      const rowId = await ctx.db.insert("bulkRows", {
        jobId,
        rowIndex: row.rowIndex,
        values: row.values,
        status: row.status,
        errors: row.errors,
      });
      rowIds.push(rowId);
    }
    await logAudit(ctx, {
      action: "bulk.started",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "bulkJob",
      resourceId: jobId,
      metadata: { templateName: args.templateName, rows: args.rows.length },
    });
    return { jobId, rowIds };
  },
});

export const getJob = query({
  args: { jobId: v.id("bulkJobs") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.jobId);
  },
});

export const getJobRows = query({
  args: { jobId: v.id("bulkJobs") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("bulkRows")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("bulkJobs").withIndex("by_createdAt").order("desc").take(50);
  },
});

/** Mint the next certificate id for a year (PREFIX-YEAR-NNNNNN). */
async function mintId(ctx: any, prefix: string, padding: number, year: number) {
  const key = `cert-${year}`;
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
  const next = (counter?.value ?? 0) + 1;
  if (counter) {
    await ctx.db.patch(counter._id, { value: next });
  } else {
    await ctx.db.insert("counters", { key, value: next });
  }
  return `${prefix}-${year}-${String(next).padStart(padding, "0")}`;
}

/**
 * Generate certificates for the given row ids of a job. Called in chunks from
 * the client with a progress bar; each call is a transaction, so progress is
 * durable and the UI never blocks on a giant single request.
 */
export const generateChunk = mutation({
  args: {
    jobId: v.id("bulkJobs"),
    rowIds: v.array(v.id("bulkRows")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Bulk job not found.");
    const settings = await getSettings(ctx);
    const template = await ctx.db.get(job.templateId);
    if (!template) throw new Error("Template no longer exists.");
    const now = Date.now();
    let generated = 0;
    let failed = 0;
    for (const rowId of args.rowIds) {
      const row = await ctx.db.get(rowId);
      if (!row || row.status === "generated") continue;
      const name = (row.values["recipientName"] ?? "").trim();
      if (!name) {
        await ctx.db.patch(rowId, {
          status: "failed",
          errors: ["Recipient name is missing."],
        });
        failed++;
        continue;
      }
      try {
        const certificateId = await mintId(
          ctx,
          settings.certificateIdPrefix,
          settings.certificateIdPadding,
          new Date().getFullYear(),
        );
        await ctx.db.insert("certificates", {
          certificateId,
          templateId: job.templateId,
          templateName: template.name,
          templateVersion: template.version,
          category: template.category,
          recipientName: name,
          orgName: settings.organizationName,
          values: Object.entries(row.values)
            .filter(([key]) => key !== "recipientName")
            .map(([key, value]) => ({ key, label: key, value })),
          issueDate: row.values["issueDate"] ?? new Date().toISOString().slice(0, 10),
          status: "active",
          verifyCount: 0,
          batchJobId: args.jobId,
          createdBy: user._id,
          createdAt: now,
        });
        await ctx.db.patch(rowId, { status: "generated", certificateId });
        generated++;
      } catch {
        await ctx.db.patch(rowId, { status: "failed", errors: ["Generation failed."] });
        failed++;
      }
    }
    await ctx.db.patch(args.jobId, {
      generatedCount: job.generatedCount + generated,
      failedCount: job.failedCount + failed,
    });
    return { generated, failed };
  },
});

export const beginGeneration = mutation({
  args: { jobId: v.id("bulkJobs") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Bulk job not found.");
    await ctx.db.patch(args.jobId, { status: "generating" });
    await logAudit(ctx, {
      action: "bulk.generation_started",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "bulkJob",
      resourceId: args.jobId,
      metadata: { totalRows: job.totalRows },
    });
  },
});

export const finishGeneration = mutation({
  args: {
    jobId: v.id("bulkJobs"),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Bulk job not found.");
    await ctx.db.patch(args.jobId, {
      status: args.success ? "completed" : "failed",
      completedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: args.success ? "bulk.completed" : "bulk.failed",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "bulkJob",
      resourceId: args.jobId,
      metadata: {
        generated: job.generatedCount,
        failed: job.failedCount,
        total: job.totalRows,
      },
    });
  },
});

export const fixRow = mutation({
  args: {
    rowId: v.id("bulkRows"),
    values: v.record(v.string(), v.string()),
    valid: v.boolean(),
    errors: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.rowId, {
      values: args.values,
      status: args.valid ? "valid" : "error",
      errors: args.errors,
    });
  },
});
