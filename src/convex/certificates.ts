import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser, getSettings, logAudit } from "./kudo";
import type { Id } from "./_generated/dataModel";

/** Format an ISO date (yyyy-mm-dd) as "25 September 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!y || !m || !d) return iso;
  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}

/** Mint the next sequential certificate id: PREFIX-YEAR-NNNNNN. */
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
 * Public verification lookup (no auth required). A mutation so each attempt
 * is recorded in the append-only verification trail.
 */
export const publicVerify = mutation({
  args: { certificateId: v.string() },
  handler: async (ctx, args) => {
    const id = args.certificateId.trim().toUpperCase();
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificateId", (q) => q.eq("certificateId", id))
      .unique();
    const now = Date.now();
    if (!cert) {
      return { result: "not_found" as const };
    }
    let result: "verified" | "revoked" | "expired" = "verified";
    if (cert.status === "revoked") result = "revoked";
    else if (cert.expiryDate && cert.expiryDate < new Date().toISOString().slice(0, 10))
      result = "expired";
    await ctx.db.insert("verificationRecords", {
      certificateRowId: cert._id,
      certificateId: id,
      method: "link",
      result,
      createdAt: now,
    });
    if (result === "verified") {
      await ctx.db.patch(cert._id, { verifyCount: cert.verifyCount + 1 });
    }
    const template = await ctx.db.get(cert.templateId);
    return {
      result,
      certificate: {
        certificateId: cert.certificateId,
        recipientName: cert.recipientName,
        templateName: cert.templateName,
        category: cert.category,
        orgName: cert.orgName,
        issueDate: cert.issueDate,
        issueDateFormatted: formatDate(cert.issueDate),
        expiryDate: cert.expiryDate,
        revokedReason: cert.revokedReason,
        values: cert.values,
        verifyCount: cert.verifyCount,
      },
    };
  },
});

/** Public render of a certificate (no auth) — used by the verify page. */
export const publicCertificateData = query({
  args: { certificateId: v.string() },
  handler: async (ctx, args) => {
    const id = args.certificateId.trim().toUpperCase();
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificateId", (q) => q.eq("certificateId", id))
      .unique();
    if (!cert) return null;
    const template = await ctx.db.get(cert.templateId);
    const version = template
      ? await ctx.db
          .query("templateVersions")
          .withIndex("by_template_version", (q) =>
            q.eq("templateId", cert.templateId).eq("version", cert.templateVersion),
          )
          .unique()
      : undefined;
    const renderUrl = template ? await ctx.storage.getUrl(template.renderStorageId) : null;
    return {
      status: cert.status,
      certificateId: cert.certificateId,
      recipientName: cert.recipientName,
      orgName: cert.orgName,
      issueDate: cert.issueDate,
      issueDateFormatted: formatDate(cert.issueDate),
      expiryDate: cert.expiryDate,
      revokedReason: cert.revokedReason,
      values: cert.values,
      templateName: cert.templateName,
      category: cert.category,
      assetWidth: template?.assetWidth ?? 1600,
      assetHeight: template?.assetHeight ?? 1131,
      renderUrl,
      fields: version?.fields ?? [],
    };
  },
});

export const getCertificate = query({
  args: { id: v.id("certificates") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const cert = await ctx.db.get(args.id);
    if (!cert) return null;
    const template = await ctx.db.get(cert.templateId);
    const version = template
      ? await ctx.db
          .query("templateVersions")
          .withIndex("by_template_version", (q) =>
            q.eq("templateId", cert.templateId).eq("version", cert.templateVersion),
          )
          .unique()
      : undefined;
    return {
      ...cert,
      issueDateFormatted: formatDate(cert.issueDate),
      assetWidth: template?.assetWidth ?? 1600,
      assetHeight: template?.assetHeight ?? 1131,
      renderUrl: template ? await ctx.storage.getUrl(template.renderStorageId) : null,
      fields: version?.fields ?? [],
    };
  },
});

export const listCertificates = query({
  args: {
    search: v.optional(v.string()),
    templateId: v.optional(v.id("templates")),
    status: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let certs = await ctx.db.query("certificates").withIndex("by_createdAt").order("desc").collect();
    const search = args.search?.trim().toLowerCase();
    if (search) {
      certs = certs.filter(
        (c) =>
          c.certificateId.toLowerCase().includes(search) ||
          c.recipientName.toLowerCase().includes(search) ||
          c.templateName.toLowerCase().includes(search),
      );
    }
    if (args.templateId) certs = certs.filter((c) => c.templateId === args.templateId);
    if (args.status) certs = certs.filter((c) => c.status === args.status);
    if (args.fromDate) certs = certs.filter((c) => c.issueDate >= args.fromDate!);
    if (args.toDate) certs = certs.filter((c) => c.issueDate <= args.toDate!);
    return certs.slice(0, args.limit ?? 500);
  },
});

export const generateCertificate = mutation({
  args: {
    templateId: v.id("templates"),
    recipientName: v.string(),
    recipientEmail: v.optional(v.string()),
    issueDate: v.string(),
    expiryDate: v.optional(v.string()),
    values: v.array(v.object({ key: v.string(), label: v.string(), value: v.string() })),
    customCertificateId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const settings = await getSettings(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found.");
    const name = args.recipientName.trim();
    if (!name) throw new Error("Recipient name is required.");

    let certificateId: string;
    if (args.customCertificateId) {
      const custom = args.customCertificateId.trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]*$/.test(custom)) {
        throw new Error("Certificate ID can only contain letters, numbers and dashes.");
      }
      const existing = await ctx.db
        .query("certificates")
        .withIndex("by_certificateId", (q) => q.eq("certificateId", custom))
        .unique();
      if (existing) throw new Error(`Certificate ID "${custom}" is already in use.`);
      certificateId = custom;
    } else {
      certificateId = await mintId(ctx, settings.certificateIdPrefix, settings.certificateIdPadding, new Date().getFullYear());
    }

    const now = Date.now();
    const id = await ctx.db.insert("certificates", {
      certificateId,
      templateId: args.templateId,
      templateName: template.name,
      templateVersion: template.version,
      category: template.category,
      recipientName: name,
      recipientEmail: args.recipientEmail,
      orgName: settings.organizationName,
      values: args.values,
      issueDate: args.issueDate,
      expiryDate: args.expiryDate,
      status: "active",
      verifyCount: 0,
      createdBy: user._id,
      createdAt: now,
    });
    await logAudit(ctx, {
      action: "certificate.created",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "certificate",
      resourceId: id,
      metadata: { certificateId, templateName: template.name, recipient: name },
    });
    return { id, certificateId };
  },
});

export const revokeCertificate = mutation({
  args: { id: v.id("certificates"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const cert = await ctx.db.get(args.id);
    if (!cert) throw new Error("Certificate not found.");
    if (cert.status === "revoked") throw new Error("Certificate is already revoked.");
    await ctx.db.patch(args.id, {
      status: "revoked",
      revokedReason: args.reason,
      revokedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "certificate.revoked",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "certificate",
      resourceId: args.id,
      metadata: { certificateId: cert.certificateId, reason: args.reason },
    });
  },
});

export const reissueCertificate = mutation({
  args: { id: v.id("certificates") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const cert = await ctx.db.get(args.id);
    if (!cert) throw new Error("Certificate not found.");
    const settings = await getSettings(ctx);
    const template = await ctx.db.get(cert.templateId);
    if (!template) throw new Error("Original template no longer exists.");
    const certificateId = await mintId(
      ctx,
      settings.certificateIdPrefix,
      settings.certificateIdPadding,
      new Date().getFullYear(),
    );
    const now = Date.now();
    const newId = await ctx.db.insert("certificates", {
      certificateId,
      templateId: cert.templateId,
      templateName: template.name,
      templateVersion: template.version, // latest version
      category: template.category,
      recipientName: cert.recipientName,
      recipientEmail: cert.recipientEmail,
      orgName: settings.organizationName,
      values: cert.values,
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate: cert.expiryDate,
      status: "active",
      verifyCount: 0,
      createdBy: user._id,
      createdAt: now,
    });
    await logAudit(ctx, {
      action: "certificate.reissued",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "certificate",
      resourceId: newId,
      metadata: { from: cert.certificateId, to: certificateId },
    });
    return { id: newId, certificateId };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const certs = await ctx.db.query("certificates").collect();
    const templates = await ctx.db.query("templates").collect();
    const verifications = await ctx.db
      .query("verificationRecords")
      .withIndex("by_createdAt")
      .order("desc")
      .take(5000);
    const verifiedSet = new Set(
      verifications.filter((v) => v.result === "verified").map((v) => v.certificateId),
    );
    const thisMonth = certs.filter((c) => c.createdAt >= monthStart).length;
    return {
      totalTemplates: templates.filter((t) => t.status !== "archived").length,
      certificatesIssued: certs.length,
      certificatesVerified: verifiedSet.size,
      certificatesThisMonth: thisMonth,
      revoked: certs.filter((c) => c.status === "revoked").length,
      active: certs.filter((c) => c.status === "active").length,
    };
  },
});

export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(12);
    return logs;
  },
});

export const recordDownload = mutation({
  args: { id: v.id("certificates"), format: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const cert = await ctx.db.get(args.id);
    if (!cert) return;
    await logAudit(ctx, {
      action: "certificate.downloaded",
      actorId: user._id,
      actorEmail: user.email,
      resourceType: "certificate",
      resourceId: args.id,
      metadata: { certificateId: cert.certificateId, format: args.format },
    });
  },
});
