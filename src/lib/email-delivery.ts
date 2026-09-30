import { renderForExport } from "@/components/certificate-canvas";
import { canvasToPdfBlob } from "@/lib/certificate";
import type { CertificateField } from "@/lib/certificate";

/** Convex action signature (useAction(api.emails.sendCertificatePdf)). */
export type SendCertificatePdfFn = (args: {
  to: string;
  subject: string;
  html: string;
  fileName: string;
  pdfBase64: string;
  certificateId: string;
  certificateRowId?: string;
  bulk?: boolean;
}) => Promise<{ ok: true }>;

/** Shape needed to render + email one certificate. */
export interface EmailableCertificate {
  certificateId: string;
  recipientName: string;
  renderUrl: string | null;
  assetWidth: number;
  assetHeight: number;
  fields: CertificateField[];
  values: Array<{ key: string; label: string; value: string }>;
  /** Optional Convex row id, recorded in the audit trail when provided. */
  rowId?: string;
}

/** Escape a string for safe interpolation into the email HTML. */
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function htmlBody(args: {
  recipientName: string;
  certificateId: string;
  verifyUrl: string;
  orgName: string;
}): string {
  return `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#1f2937">
  <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#2e6b5e;margin:0 0 12px">${esc(args.orgName)}</p>
  <h1 style="font-size:22px;margin:0 0 10px">Your certificate is ready</h1>
  <p style="margin:0 0 8px">Hello <strong>${esc(args.recipientName)}</strong>,</p>
  <p style="margin:0 0 14px">
    Congratulations — your certificate <strong>${esc(args.certificateId)}</strong> is attached as a PDF.
    Anyone can confirm its authenticity at any time:
  </p>
  <p style="margin:0 0 18px">
    <a href="${args.verifyUrl}" style="display:inline-block;background:#2e6b5e;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">
      Verify this certificate
    </a>
  </p>
  <p style="margin:0;font-size:12px;color:#6b7280">
    The verification link and the QR code on the certificate both open a public page that checks
    this ID against the issuer's live records.
  </p>
</div>`.trim();
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the rendered PDF."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Render the certificate to a PDF and email it as an attachment. The PDF is
 * produced by the same engine as the download flow, so recipients receive the
 * exact document they would get from "Download PDF".
 */
export async function emailCertificatePdf(
  send: SendCertificatePdfFn,
  cert: EmailableCertificate,
  to: string,
  orgName: string,
  opts: { bulk?: boolean } = {},
): Promise<void> {
  if (!cert.renderUrl) throw new Error("The certificate's template asset is unavailable.");
  const email = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const canvas = await renderForExport({
    renderUrl: cert.renderUrl,
    assetWidth: cert.assetWidth,
    assetHeight: cert.assetHeight,
    fields: cert.fields,
    values: Object.fromEntries(cert.values.map((v) => [v.key, v.value])),
    certificateId: cert.certificateId,
    showQr: true,
  });
  const blob = await canvasToPdfBlob(canvas);
  const pdfBase64 = await blobToBase64(blob);
  const verifyUrl = `${window.location.origin}/verify/${cert.certificateId}`;

  await send({
    to: email,
    subject: `Your certificate from ${orgName} (${cert.certificateId})`,
    html: htmlBody({
      recipientName: cert.recipientName,
      certificateId: cert.certificateId,
      verifyUrl,
      orgName,
    }),
    fileName: `credora-${cert.certificateId}.pdf`,
    pdfBase64,
    certificateId: cert.certificateId,
    certificateRowId: cert.rowId,
    bulk: opts.bulk,
  });
}
