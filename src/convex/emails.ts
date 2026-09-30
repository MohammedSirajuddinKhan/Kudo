"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserId } from "./brand";

/**
 * Map Resend/API errors to actionable guidance for the admin UI.
 */
function friendlySendError(message: string): string {
  const m = message ?? "";
  if (/testing emails to your own email address/i.test(m)) {
    return (
      "Resend sandbox: emails can only go to your own account address until a domain is verified. " +
      "Verify your domain at resend.com/domains, then set the EMAIL_FROM env var " +
      '(e.g. "Credora <certificates@yourdomain.com>") and retry.'
    );
  }
  if (/missing api key/i.test(m)) {
    return "Email delivery is not configured yet. Add the RESEND_API_KEY environment variable (from resend.com/api-keys) to the Convex backend, then try again.";
  }
  if (/domain not found|unverified|not verified/i.test(m)) {
    return (
      "The sending domain isn't verified in Resend yet. Verify it at resend.com/domains and set " +
      'EMAIL_FROM (e.g. "Credora <certificates@yourdomain.com>").'
    );
  }
  if (/invalid .*(to|recipient)/i.test(m)) {
    return "That email address doesn't look valid. Check it and try again.";
  }
  return m || "Email delivery failed.";
}

/**
 * Email delivery of certificate PDFs via Resend (transactional email API with
 * native attachments). Runs as a node action ("use node": the Resend SDK needs
 * Node's Buffer). Renders nothing here — the caller (browser) produces the
 * PDF bytes and posts them along.
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
      throw new Error(friendlySendError("Missing API key."));
    }

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      // Resend requires a verified sender domain for arbitrary recipients;
      // the default onboarding sender is sandbox-restricted to the account
      // owner's own address. Override with the EMAIL_FROM env var once a
      // domain is verified.
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
      throw new Error(friendlySendError(error.message));
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
