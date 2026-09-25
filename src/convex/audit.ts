import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, logAudit } from "./kudo";

export const listAuditLogs = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit ?? 300);
    const search = args.search?.trim().toLowerCase();
    if (!search) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(search) ||
        l.resourceType.toLowerCase().includes(search) ||
        (l.actorEmail ?? "").toLowerCase().includes(search),
    );
  },
});

export const getReports = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const certs = await ctx.db.query("certificates").collect();
    const templates = await ctx.db.query("templates").collect();
    const jobs = await ctx.db.query("bulkJobs").collect();
    const verifications = await ctx.db
      .query("verificationRecords")
      .withIndex("by_createdAt")
      .order("desc")
      .take(5000);

    // Issuance over the last 12 months (or less if younger).
    const monthBuckets: Array<{ key: string; label: string; count: number }> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets.push({
        key,
        label: d.toLocaleString("en-US", { month: "short" }),
        count: 0,
      });
    }
    const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
    for (const c of certs) {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = bucketByKey.get(key);
      if (bucket) bucket.count++;
    }

    // Per-template breakdown.
    const byTemplate = templates
      .map((t) => ({
        name: t.name,
        count: certs.filter((c) => c.templateId === t._id).length,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Per-category breakdown.
    const catMap = new Map<string, number>();
    for (const c of certs) {
      const cat = c.category ?? "Uncategorized";
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const verifiedIds = new Set(
      verifications.filter((v) => v.result === "verified").map((v) => v.certificateId),
    );

    return {
      issuedOverTime: monthBuckets,
      byTemplate,
      byCategory,
      totals: {
        issued: certs.length,
        verified: verifiedIds.size,
        revoked: certs.filter((c) => c.status === "revoked").length,
        verificationAttempts: verifications.length,
        bulkJobs: jobs.length,
        bulkGenerated: jobs.reduce((sum, j) => sum + j.generatedCount, 0),
        bulkFailed: jobs.reduce((sum, j) => sum + j.failedCount, 0),
      },
    };
  },
});

export const updateSettings = mutation({
  args: {
    organizationName: v.string(),
    certificateIdPrefix: v.string(),
    certificateIdPadding: v.number(),
    showQrOnCertificates: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!args.organizationName.trim()) {
      throw new Error("Organization name is required.");
    }
    const prefix = args.certificateIdPrefix.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(prefix)) {
      throw new Error("ID prefix must be 1-10 letters or numbers.");
    }
    if (args.certificateIdPadding < 3 || args.certificateIdPadding > 10) {
      throw new Error("ID padding must be between 3 and 10 digits.");
    }
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const values = {
      key: "global",
      organizationName: args.organizationName.trim(),
      certificateIdPrefix: prefix,
      certificateIdPadding: args.certificateIdPadding,
      showQrOnCertificates: args.showQrOnCertificates,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("settings", values);
    }
    await logAudit(ctx, {
      action: "settings.changed",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "settings",
      resourceId: "global",
      metadata: { organizationName: values.organizationName },
    });
    return values;
  },
});
