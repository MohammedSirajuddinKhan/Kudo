import { useEffect, useRef } from "react";
import { renderCertificate, loadQrImage } from "@/lib/certificate";
import type { CertificateField } from "@/lib/certificate";

/** Live canvas preview (non-interactive). */
export function PreviewCanvasLight({
  renderUrl,
  assetWidth,
  assetHeight,
  fields,
  values,
  certificateId,
  showQr,
  qrImage,
}: {
  renderUrl: string | null;
  assetWidth: number;
  assetHeight: number;
  fields: CertificateField[];
  values: Record<string, string>;
  certificateId: string;
  showQr: boolean;
  qrImage?: HTMLImageElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      if (!canvasRef.current) return;
      try {
        await renderCertificate(canvasRef.current, {
          imageUrl: renderUrl ?? "",
          assetWidth,
          assetHeight,
          fields,
          values,
          certificateId,
          verifyUrl: `${window.location.origin}/verify/${certificateId}`,
          showQr,
          qrImage,
          testMode: false,
          scale: Math.min(1.1, 1300 / Math.max(1, assetWidth)),
        });
      } catch {
        // Non-fatal: leave the canvas blank on transient image load issues.
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [renderUrl, assetWidth, assetHeight, fields, values, certificateId, showQr, qrImage]);

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 720 }}>
      <div className="editor-canvas overflow-hidden rounded-lg bg-white">
        {renderUrl ? (
          <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Certificate preview" />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Template image unavailable.
          </div>
        )}
      </div>
    </div>
  );
}

/** Render at export scale and hand back the canvas (no DOM attachment). */
export async function renderForExport(opts: {
  renderUrl: string;
  assetWidth: number;
  assetHeight: number;
  fields: CertificateField[];
  values: Record<string, string>;
  certificateId: string;
  showQr: boolean;
  scale?: number;
}): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  let qrImage: HTMLImageElement | null = null;
  if (opts.showQr) {
    qrImage = await loadQrImage(`${window.location.origin}/verify/${opts.certificateId}`);
  }
  await renderCertificate(canvas, {
    imageUrl: opts.renderUrl,
    assetWidth: opts.assetWidth,
    assetHeight: opts.assetHeight,
    fields: opts.fields,
    values: opts.values,
    certificateId: opts.certificateId,
    verifyUrl: `${window.location.origin}/verify/${opts.certificateId}`,
    showQr: opts.showQr,
    qrImage,
    testMode: false,
    scale: opts.scale ?? 2,
  });
  return canvas;
}
