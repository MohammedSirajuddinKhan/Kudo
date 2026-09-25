import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Generate a short-lived upload URL for Convex file storage. Only signed-in
 * admins can obtain one. File type/size is validated client-side and the
 * template record links the stored asset.
 */
export const generateUploadUrl = mutation({
  args: { fileName: v.string() },
  handler: async (ctx, _args) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Returns the signed-in user id, or null. Works in queries, mutations and
 * actions (anything with an auth context).
 */
export async function getOptionalUserId(ctx: { auth: any }): Promise<Id<"users"> | null> {
  try {
    return await getAuthUserId(ctx);
  } catch {
    return null;
  }
}

/** Requires a signed-in user id. Works in queries, mutations and actions. */
export async function requireUserId(ctx: { auth: any }): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("You must be signed in as an administrator to do that.");
  }
  return userId;
}

/** Returns the signed-in (non-anonymous) user document, or null. DB contexts only. */
export async function getOptionalUser(ctx: { db: any; auth: any }): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  if (user.isAnonymous) return null;
  return user;
}

/** Throws when there is no signed-in (non-anonymous) admin user. DB contexts only. */
export async function requireUser(ctx: { db: any; auth: any }): Promise<Doc<"users">> {
  const user = await getOptionalUser(ctx);
  if (!user) throw new Error("You must be signed in as an administrator to do that.");
  return user;
}

/** Internal: user info for actions, which cannot touch the database directly. */
export const getUserInfoInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isAnonymous) {
      throw new Error("You must be signed in as an administrator to do that.");
    }
    return { _id: user._id, email: user.email ?? "admin" };
  },
});

/** Internal: append to the audit log from actions. */
export const writeAuditInternal = internalMutation({
  args: {
    action: v.string(),
    actorId: v.optional(v.id("users")),
    actorEmail: v.optional(v.string()),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      action: args.action,
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

/** Append to the audit log (append-only; no update/delete exposed). DB contexts only. */
export async function logAudit(
  ctx: { db: any },
  entry: {
    action: string;
    actorId?: Id<"users"> | null;
    actorEmail?: string | null;
    resourceType: string;
    resourceId?: string;
    metadata?: any;
  },
) {
  await ctx.db.insert("auditLogs", {
    action: entry.action,
    actorId: entry.actorId ?? undefined,
    actorEmail: entry.actorEmail ?? undefined,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    metadata: entry.metadata,
    createdAt: Date.now(),
  });
}

/** Default deployment settings, merged with the stored settings row. */
export async function getSettings(ctx: { db: any }) {
  const stored = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", "global"))
    .unique();
  const defaults = {
    organizationName: "Demo University",
    certificateIdPrefix: "KUDO",
    certificateIdPadding: 6,
    showQrOnCertificates: true,
  };
  if (!stored) return { ...defaults, key: "global", updatedAt: Date.now() };
  return { ...defaults, ...stored };
}
