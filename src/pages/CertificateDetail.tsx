import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Ban,
  FileDown,
  ImageDown,
  Link2,
  Loader2,
  Printer,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { GlassPanel, PageHeader, formatDate, formatDateTime } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QrCodeCanvas } from "./CertificateCreate";
import { PreviewCanvasLight, renderForExport } from "@/components/certificate-canvas";
import { exportCanvasAsPdf, exportCanvasAsPng } from "@/lib/certificate";
import type { CertificateField } from "@/lib/certificate";

export default function CertificateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cert = useQuery(api.certificates.getCertificate, { id: id as any });
  const settings = useQuery(api.templates.getSettingsQuery);
  const revoke = useMutation(api.certificates.revokeCertificate);
  const reissue = useMutation(api.certificates.reissueCertificate);
  const recordDownload = useMutation(api.certificates.recordDownload);

  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState("");

  const doExport = async (format: "pdf" | "png") => {
    if (!cert?.renderUrl) return;
    setExporting(format);
    try {
      const canvas = await renderForExport({
        renderUrl: cert.renderUrl,
        assetWidth: cert.assetWidth ?? 1600,
        assetHeight: cert.assetHeight ?? 1131,
        fields: (cert.fields ?? []) as CertificateField[],
        values: Object.fromEntries((cert.values ?? []).map((v) => [v.key, v.value])),
        certificateId: cert.certificateId,
        showQr: settings?.showQrOnCertificates ?? true,
        scale: 2.2,
      });
      const fileName = `kudo-${cert.certificateId}`;
      if (format === "pdf") {
        await exportCanvasAsPdf(canvas, fileName);
      } else {
        exportCanvasAsPng(canvas, fileName);
      }
      await recordDownload({ id: cert._id as any, format });
      toast.success(`Downloaded as ${format.toUpperCase()}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export the certificate.");
    } finally {
      setExporting(null);
    }
  };

  const handleRevoke = async () => {
    if (!cert || !reason.trim()) return;
    try {
      await revoke({ id: cert._id as any, reason: reason.trim() });
      toast.success("Certificate revoked.");
      setRevokeOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke.");
    }
  };

  const handleReissue = async () => {
    if (!cert) return;
    try {
      const r = await reissue({ id: cert._id as any });
      toast.success(`Reissued as ${r.certificateId}.`);
      navigate(`/certificates/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reissue.");
    }
  };

  if (cert === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (cert === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Certificate not found.</p>
        <Button variant="ghost" onClick={() => navigate("/certificates")}>
          <ArrowLeft className="mr-1 size-4" /> Certificates
        </Button>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/verify/${cert.certificateId}`;

  return (
    <div>
      <PageHeader
        title={cert.certificateId}
        description={`Issued ${formatDateTime(cert.createdAt)} · template v${cert.templateVersion}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/certificates")}>
              <ArrowLeft className="mr-1 size-4" /> Certificates
            </Button>
            {cert.status === "active" ? (
              <Button variant="outline" className="glass border-destructive/40 text-destructive" onClick={() => setRevokeOpen(true)}>
                <Ban className="mr-1.5 size-4" /> Revoke
              </Button>
            ) : (
              <Button variant="outline" className="glass border-border/40" onClick={() => void handleReissue()}>
                <RotateCcw className="mr-1.5 size-4" /> Reissue
              </Button>
            )}
            <Button onClick={() => void doExport("pdf")} disabled={exporting !== null}>
              {exporting === "pdf" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <FileDown className="mr-1.5 size-4" />
              )}
              PDF
            </Button>
            <Button variant="outline" className="glass border-border/40" onClick={() => void doExport("png")} disabled={exporting !== null}>
              {exporting === "png" ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <ImageDown className="mr-1.5 size-4" />
              )}
              PNG
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <GlassPanel className="p-4">
          {cert.renderUrl ? (
            <CertificatePreview
              cert={cert}
              showQr={settings?.showQrOnCertificates ?? true}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Template asset unavailable.
            </div>
          )}
        </GlassPanel>

        <div className="space-y-4">
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Status</h2>
              <Badge variant={cert.status === "active" ? "secondary" : "destructive"}>
                {cert.status === "active" ? "Active" : "Revoked"}
              </Badge>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Recipient</dt>
                <dd className="font-medium">{cert.recipientName}</dd>
              </div>
              {cert.recipientEmail && (
                <div>
                  <dt className="text-xs text-muted-foreground uppercase">Email</dt>
                  <dd className="font-medium">{cert.recipientEmail}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Template</dt>
                <dd className="font-medium">
                  {cert.templateName}{" "}
                  <Link to={`/templates/${cert.templateId}/edit`} className="text-xs text-primary hover:underline">
                    (open)
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Issue date</dt>
                <dd className="font-medium">{formatDate(cert.issueDate)}</dd>
              </div>
              {cert.expiryDate && (
                <div>
                  <dt className="text-xs text-muted-foreground uppercase">Expiry</dt>
                  <dd className="font-medium">{formatDate(cert.expiryDate)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Verifications</dt>
                <dd className="font-medium">{cert.verifyCount}</dd>
              </div>
              {cert.status === "revoked" && cert.revokedReason && (
                <div>
                  <dt className="text-xs text-destructive uppercase">Revocation reason</dt>
                  <dd className="text-destructive">{cert.revokedReason}</dd>
                </div>
              )}
            </dl>
          </GlassPanel>

          {(cert.values ?? []).filter((v) => v.value).length > 0 && (
            <GlassPanel className="p-5">
              <h2 className="mb-3 font-semibold">Field values</h2>
              <dl className="space-y-2 text-sm">
                {cert.values
                  .filter((v) => v.value)
                  .map((v) => (
                    <div key={v.key} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{v.label}</dt>
                      <dd className="text-right font-medium">{v.value}</dd>
                    </div>
                  ))}
              </dl>
            </GlassPanel>
          )}

          <GlassPanel className="p-5">
            <h2 className="mb-3 font-semibold">Share & verify</h2>
            <div className="mx-auto max-w-[180px] rounded-xl bg-white p-2.5 shadow-sm">
              <QrCodeCanvas url={verifyUrl} className="size-full" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                className="glass border-border/40"
                onClick={() => {
                  void navigator.clipboard.writeText(verifyUrl);
                  toast.success("Verification link copied");
                }}
              >
                <Link2 className="mr-1.5 size-4" /> Copy verification link
              </Button>
              <Button
                variant="outline"
                className="glass border-border/40"
                onClick={() => {
                  void navigator.clipboard.writeText(verifyUrl);
                  window.open(`/verify/${cert.certificateId}`, "_blank");
                }}
              >
                <QrCode className="mr-1.5 size-4" /> Open public page
              </Button>
              <Button
                variant="ghost"
                onClick={() => window.print()}
              >
                <Printer className="mr-1.5 size-4" /> Print
              </Button>
            </div>
          </GlassPanel>
        </div>
      </div>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {cert.certificateId}?</AlertDialogTitle>
            <AlertDialogDescription>
              The record is preserved. Public verification will show CERTIFICATE REVOKED with
              your reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-1">
            <Label htmlFor="revoke-reason-2">Reason (public)</Label>
            <input
              id="revoke-reason-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Issued in error"
              className="glass-input mt-1.5 h-9 w-full rounded-md border border-border px-3 text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!reason.trim()}
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Renders the final certificate on a canvas with real values + QR. */
function CertificatePreview({
  cert,
  showQr,
}: {
  cert: {
    renderUrl: string | null;
    assetWidth?: number;
    assetHeight?: number;
    fields?: unknown[];
    values: Array<{ key: string; label: string; value: string }>;
    certificateId: string;
  };
  showQr: boolean;
}) {
  return (
    <PreviewCanvasLight
      renderUrl={cert.renderUrl}
      assetWidth={cert.assetWidth ?? 1600}
      assetHeight={cert.assetHeight ?? 1131}
      fields={(cert.fields ?? []) as CertificateField[]}
      values={Object.fromEntries((cert.values ?? []).map((v) => [v.key, v.value]))}
      certificateId={cert.certificateId}
      showQr={showQr}
    />
  );
}
