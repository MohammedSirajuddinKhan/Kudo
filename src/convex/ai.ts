import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { requireUserId, writeAuditInternal } from "./kudo";
import { internal } from "./_generated/api";

const SYSTEM_PROMPT = `You are a certificate template analyzer for Kudo, a digital certificate platform.
You will receive an image of a certificate. Identify the editable regions (blank spaces, underlines,
boxes, or placeholder text) where personalized data should be typed when the certificate is issued.

Rules:
- Report coordinates as fractions of the full image size (0.0 to 1.0): x, y, width, height.
  x/y is the TOP-LEFT corner of the region.
- For an underline or blank line, use a box that tightly covers where the text should sit,
  extending slightly above the line.
- Suggest a meaningful field name (e.g. "Student Name", "Course Name", "Issue Date") based on
  the surrounding text. Never use generic names like "field1".
- Suggest a type: text, date, number, email, or certificateId.
- Include an appropriate fontSize relative to the certificate (roughly 0.018 to 0.05 of the
  image height) and estimate the color from the certificate's text (hex like "#1a1a2e").
- Confidence is 0.0 to 1.0 — be honest; low confidence is fine.
- Only report regions that should receive dynamic content. Always include a QR code suggestion
  (type "qr") in a bottom corner if there is clear space.
- Return ONLY valid JSON matching the requested schema, with no markdown or commentary.`;

export interface AiField {
  id: string;
  name: string;
  type: "text" | "date" | "number" | "email" | "certificateId" | "qr";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  color: string;
  align: "left" | "center" | "right";
  vAlign: "top" | "middle" | "bottom";
  letterSpacing: number;
  lineHeight: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  autoFit: boolean;
  wrap: boolean;
  required: boolean;
  placeholder?: string;
  source: "ai";
  confidence: number;
}

/** Internal fetch of the render asset URL (actions fetch bytes over HTTPS). */
export const getRenderAssetUrl = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.id);
    if (!t) return null;
    return await ctx.storage.getUrl(t.renderStorageId);
  },
});

/** Internal fetch of template metadata needed for analysis. */
export const getTemplateMeta = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.id);
    if (!t) return null;
    return {
      assetFileName: t.assetFileName,
      assetType: t.assetType,
      assetWidth: t.assetWidth,
      assetHeight: t.assetHeight,
    };
  },
});

export const analyzeTemplate = action({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args): Promise<{ ok: boolean; fields?: AiField[]; error?: string }> => {
    const userId = await requireUserId(ctx);
    const userInfo = await ctx.runQuery(internal.kudo.getUserInfoInternal, { userId });
    const template = await ctx.runQuery(internal.ai.getTemplateMeta, { id: args.templateId });
    if (!template) return { ok: false, error: "Template not found." };

    try {
      const renderUrl = await ctx.runQuery(internal.ai.getRenderAssetUrl, { id: args.templateId });
      if (!renderUrl) {
        return { ok: false, error: "Could not read the uploaded template file." };
      }
      const response = await fetch(renderUrl);
      if (!response.ok) {
        return { ok: false, error: "Could not read the uploaded template file." };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const lower = template.assetFileName.toLowerCase();
      const mimeType =
        template.assetType === "pdf"
          ? "image/png"
          : lower.endsWith(".png")
            ? "image/png"
            : lower.endsWith(".webp")
              ? "image/webp"
              : "image/jpeg";

      // The VLY integration gateway routes to a vision-capable model. The API
      // key lives server-side; nothing is exposed to the client.
      const { createVlyIntegrations } = await import("@vly-ai/integrations");
      const vly = createVlyIntegrations({ deploymentToken: process.env.VLY_INTEGRATION_KEY! });
      const completion = await vly.ai.completion({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analyze this certificate design and identify the editable regions where personalized " +
                  'data will be typed. Return JSON: {"fields": [{name, type, x, y, width, height, fontSize, color, confidence}]}. ' +
                  "Coordinates are fractions (0-1) of the image, top-left origin. Always include one type \"qr\" region in a clear bottom corner.",
              },
              { type: "image", image: `data:${mimeType};base64,${base64}` },
            ] as unknown as string,
          },
        ],
        temperature: 0.1,
        maxTokens: 2000,
      });

      if (!completion.success || !completion.data) {
        const message = completion.error ?? "The AI analysis service is unavailable right now.";
        await ctx.runMutation(internal.kudo.writeAuditInternal, {
          action: "ai.analysis_failed",
          actorId: userId,
          actorEmail: userInfo.email,
          resourceType: "template",
          resourceId: args.templateId,
          metadata: { reason: message.slice(0, 160) },
        });
        return { ok: false, error: message };
      }

      const raw = completion.data.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(raw);
      const candidateFields = Array.isArray(parsed?.fields) ? parsed.fields : [];

      // AI output is never trusted blindly — every field is validated and
      // clamped to sane bounds with safe fallbacks.
      const seen = new Set<string>();
      const fields: AiField[] = [];
      let index = 1;
      for (const f of candidateFields as any[]) {
        if (!f || typeof f !== "object") continue;
        const x = clamp01(Number(f.x));
        const y = clamp01(Number(f.y));
        const width = clamp01(Number(f.width));
        const height = clamp01(Number(f.height));
        if (Number.isNaN(x) || Number.isNaN(y) || width <= 0.01 || height <= 0.005) continue;
        if (x + width > 1.02 || y + height > 1.02) continue;
        let name = String(f.name ?? "").trim().slice(0, 60);
        if (!name) name = `Field ${index}`;
        let unique = name;
        let n = 2;
        while (seen.has(unique.toLowerCase())) unique = `${name} ${n++}`;
        seen.add(unique.toLowerCase());
        const type = normalizeType(f.type);
        if (type === "qr" && fields.some((g) => g.type === "qr")) continue;
        fields.push({
          id: `ai-${index++}`,
          name: unique,
          type,
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(width, 1 - Math.max(0, x)),
          height: Math.min(height, 1 - Math.max(0, y)),
          fontSize: normalizeFontSize(f.fontSize, template.assetHeight),
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: /name|title|award/i.test(name) ? 700 : 400,
          italic: false,
          underline: false,
          color: normalizeColor(f.color),
          align: "center",
          vAlign: "middle",
          letterSpacing: 0,
          lineHeight: 1.2,
          textTransform: "none",
          autoFit: true,
          wrap: false,
          required: type === "certificateId" || /name/i.test(name),
          source: "ai",
          confidence: Math.min(1, Math.max(0, Number(f.confidence) || 0.5)),
        });
      }

      await ctx.runMutation(internal.kudo.writeAuditInternal, {
        action: "ai.analyzed",
        actorId: userId,
        actorEmail: userInfo.email,
        resourceType: "template",
        resourceId: args.templateId,
        metadata: { detected: fields.length },
      });

      return { ok: true, fields };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI analysis failed unexpectedly.";
      return { ok: false, error: message.slice(0, 200) };
    }
  },
});

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeType(t: unknown): "text" | "date" | "number" | "email" | "certificateId" | "qr" {
  const s = String(t ?? "").toLowerCase();
  if (s === "date") return "date";
  if (s === "number") return "number";
  if (s === "email") return "email";
  if (s === "certificateid" || s === "certificate_id" || s === "id") return "certificateId";
  if (s === "qr") return "qr";
  return "text";
}

function normalizeFontSize(f: unknown, assetHeight: number): number {
  const height = assetHeight > 0 ? assetHeight : 1131;
  const n = typeof f === "number" && f > 0 ? f : height * 0.032;
  const min = height * 0.012;
  const max = height * 0.085;
  return Math.min(max, Math.max(min, n));
}

function normalizeColor(c: unknown): string {
  const s = String(c ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return "#1a1a2e";
}

function extractJson(raw: string): { fields?: unknown[] } | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
