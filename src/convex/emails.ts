"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserId } from "./brand";

/**
 * Email delivery of certificate PDFs via Resend (transactional email API with
 * native attachments). Runs as a node action: renders nothing here — the
 * caller (browser) produces the PDF bytes and posts them along.
 */
export const sendCertificatePdf = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    fileName: v.string(),
    // PDF bytes as a base64 string (travels as an argument, no storage hop).
    pdfBase64: v.string(),
    // Provenance for the audit trail.
    certificateId: v.string(),
    certificateRowId: v.optional(v.id("certificates")),
    bulk: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Email delivery is not configured yet. Add the RESEND_API_KEY environment variable (from resend.com/api-keys) to the Convex backend, then try again.",
      );
    }

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      // Resend requires a verified sender domain; the fallback works for
      // testing on their free tier until a domain is added.
      from: process.env.EMAIL_FROM ?? "Credora <onboarding@resend.dev>",
      to: args.to,
      subject: args.subject,
      html: args.html,
      attachments: [
        {
          filename: args.fileName,
          content: Buffer.from(args.pdfBase64, "base64"),
        },
      ],
    });
    if (error) {
      throw new Error(error.message ?? "Email delivery failed.");
    }

    const userInfo = await ctx.runQuery(internal.brand.getUserInfoInternal, { userId });
    await ctx.runMutation(internal.brand.writeAuditInternal, {
      action: args.bulk ? "certificate.emailed_bulk" : "certificate.emailed",
      actorId: userId,
      actorEmail: userInfo.email,
      resourceType: "certificate",
      resourceId: args.certificateRowId,
      metadata: {
        certificateId: args.certificateId,
        to: args.to,
        fileName: args.fileName,
      },
    });

    return { ok: true as const };
  },
});
