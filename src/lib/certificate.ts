import QRCode from "qrcode";

export type FieldType = "text" | "date" | "number" | "email" | "certificateId" | "qr";

export interface CertificateField {
  id: string;
  name: string;
  type: FieldType;
  x: number; // 0..1 of page width
  y: number; // 0..1 of page height
  width: number; // 0..1 of page width
  height: number; // 0..1 of page height
  fontSize: number; // in template pixels
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
  source: "ai" | "manual";
  confidence?: number;
}

export interface TemplateData {
  _id: string;
  name: string;
  description?: string;
  category: string;
  status: "draft" | "ready" | "archived";
  version: number;
  assetType: "image" | "pdf";
  assetFileName: string;
  assetWidth: number;
  assetHeight: number;
  renderUrl: string | null;
  fields: CertificateField[];
  updatedAt?: number;
  createdAt?: number;
  certificateCount?: number;
  originalUrl?: string | null;
}

export interface CertificateRecordData {
  _id: string;
  certificateId: string;
  templateName: string;
  templateVersion: number;
  recipientName: string;
  recipientEmail?: string;
  orgName: string;
  values: Array<{ key: string; label: string; value: string }>;
  issueDate: string;
  expiryDate?: string;
  status: "active" | "revoked";
  verifyCount: number;
  createdAt: number;
  issueDateFormatted?: string;
  fields?: CertificateField[];
  renderUrl?: string | null;
  assetWidth?: number;
  assetHeight?: number;
}

export const DEFAULT_FONT = "Georgia, 'Times New Roman', serif";

export const FONT_OPTIONS = [
  { label: "Georgia (Serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Garamond", value: "Garamond, 'Times New Roman', serif" },
  { label: "Didot", value: "Didot, 'Bodoni MT', serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  date: "Date",
  number: "Number",
  email: "Email",
  certificateId: "Certificate ID",
  qr: "QR Code",
};

export function transformText(text: string, t: CertificateField["textTransform"]): string {
  switch (t) {
    case "uppercase":
      return text.toLocaleUpperCase();
    case "lowercase":
      return text.toLocaleLowerCase();
    case "capitalize":
      return text.replace(/\b\p{L}/gu, (c) => c.toLocaleUpperCase());
    default:
      return text;
  }
}

function measure(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  letterSpacing: number,
): number {
  ctx.font = font;
  if (!text) return 0;
  const w = ctx.measureText(text).width;
  if (letterSpacing <= 0) return w;
  return w + letterSpacing * Math.max(0, Array.from(text).length - 1);
}

function fontString(f: CertificateField, size: number): string {
  const style = f.italic ? "italic " : "";
  return `${style}${f.fontWeight} ${size}px ${f.fontFamily}`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  letterSpacing: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(ctx, candidate, font, letterSpacing) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draw a text field with intelligent fitting: shrink-to-fit when autoFit is
 * enabled, wrap only when configured. Text never overflows the field box.
 */
function drawTextField(
  ctx: CanvasRenderingContext2D,
  field: CertificateField,
  raw: string,
  box: { x: number; y: number; w: number; h: number },
  testMode: boolean,
) {
  let text = transformText(raw, field.textTransform as CertificateField["textTransform"]);
  if (!text && field.placeholder) text = field.placeholder;
  if (!text && testMode) text = `Sample ${field.name}`;

  let size = field.fontSize;
  let lines: string[] = text ? [text] : [""];

  if (!field.wrap) {
    if (field.autoFit) {
      while (
        size > 6 &&
        measure(ctx, text, fontString(field, size), field.letterSpacing * (size / field.fontSize)) > box.w
      ) {
        size *= 0.94;
        if (size < 6) break;
      }
    }
  } else {
    for (let guard = 0; guard < 24; guard++) {
      const font = fontString(field, size);
      lines = wrapLines(ctx, text, box.w, font, field.letterSpacing * (size / field.fontSize));
      const totalHeight = lines.length * size * field.lineHeight;
      if (totalHeight <= box.h || size <= 6) break;
      size *= 0.92;
    }
  }

  ctx.save();
  ctx.font = fontString(field, size);
  ctx.fillStyle = field.color;
  ctx.textBaseline = "middle";
  const scaledSpacing = field.letterSpacing * (size / field.fontSize);
  const lineH = size * field.lineHeight;
  const blockH = lines.length * lineH;
  let startY = box.y;
  if (field.vAlign === "middle") startY = box.y + (box.h - blockH) / 2;
  else if (field.vAlign === "bottom") startY = box.y + box.h - blockH;

  lines.forEach((line, i) => {
    const y = startY + lineH * i + lineH / 2;
    const w = measure(ctx, line, ctx.font, scaledSpacing);
    let startX = box.x;
    if (field.align === "center") startX = box.x + (box.w - w) / 2;
    else if (field.align === "right") startX = box.x + box.w - w;

    if (field.underline && text) {
      ctx.fillRect(startX, y + size * 0.42, w, Math.max(1, size * 0.05));
    }
    if (scaledSpacing !== 0) {
      let cx = startX;
      for (const ch of Array.from(line)) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + scaledSpacing;
      }
    } else {
      ctx.fillText(line, startX, y);
    }
  });
  ctx.restore();
}

/** Render a QR code to a loaded HTMLImageElement, ready for canvas drawing. */
export async function loadQrImage(url: string, dark = "#1a1a2e"): Promise<HTMLImageElement> {
  const dataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark, light: "#ffffff" },
  });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

export interface RenderOptions {
  qrImage?: HTMLImageElement | null;
  testMode?: boolean;
  scale?: number;
}

/**
 * The Kudo rendering engine: the original template is the immutable base
 * layer, polished typeset field values sit on top, and the QR code is
 * composited last. Coordinates are normalized, so output scales losslessly
 * to any export resolution.
 */
export async function renderCertificate(
  canvas: HTMLCanvasElement,
  opts: {
    imageUrl: string;
    assetWidth: number;
    assetHeight: number;
    fields: CertificateField[];
    values: Record<string, string>;
    certificateId: string;
    /** Embedded in the verification QR code. Falls back to the current origin. */
    verifyUrl?: string;
    showQr: boolean;
    qrFieldId?: string | null;
  } & RenderOptions,
): Promise<void> {
  // opts.verifyUrl is accepted for API completeness: callers use it to render
  // the QR image itself (loadQrImage), which is then passed in as qrImage.
  const { imageUrl, assetWidth, assetHeight, fields, values, certificateId, showQr, qrFieldId, qrImage } = opts;
  const scale = opts.scale ?? 1;
  canvas.width = Math.round(assetWidth * scale);
  canvas.height = Math.round(assetHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const img = await loadImage(imageUrl);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const field of fields) {
    if (field.type === "qr") continue;
    const box = {
      x: field.x * canvas.width,
      y: field.y * canvas.height,
      w: field.width * canvas.width,
      h: field.height * canvas.height,
    };
    const raw = field.type === "certificateId" ? certificateId : (values[field.id] ?? "");
    drawTextField(ctx, field, raw, box, opts.testMode ?? false);
  }

  if (showQr && qrImage) {
    const qrField =
      (qrFieldId && fields.find((f) => f.id === qrFieldId && f.type === "qr")) ||
      fields.find((f) => f.type === "qr");
    if (qrField) {
      const box = {
        x: qrField.x * canvas.width,
        y: qrField.y * canvas.height,
        w: qrField.width * canvas.width,
        h: qrField.height * canvas.height,
      };
      const side = Math.min(box.w, box.h);
      const cx = box.x + (box.w - side) / 2;
      const cy = box.y + (box.h - side) / 2;
      ctx.fillStyle = "#ffffff";
      const pad = side * 0.08;
      ctx.fillRect(cx - pad, cy - pad, side + pad * 2, side + pad * 2);
      ctx.drawImage(qrImage, cx, cy, side, side);
    }
  }
}

export function exportCanvasAsPng(canvas: HTMLCanvasElement, fileName: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

export async function exportCanvasAsPdf(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new JsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
