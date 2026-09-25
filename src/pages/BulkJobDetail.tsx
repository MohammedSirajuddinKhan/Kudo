import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
} from "lucide-react";
import { GlassPanel, PageHeader, formatDateTime } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { renderForExport } from "@/components/certificate-canvas";
import { downloadZip } from "@/lib/files";
import type { CertificateField } from "@/lib/certificate";

export default function BulkJobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const job = useQuery(api.bulk.getJob, { jobId: jobId as any });
  const rows = useQuery(api.bulk.getJobRows, { jobId: jobId as any });
  const template = useQuery(api.templates.getTemplate, {
    id: (job?.templateId ?? "j") as any,
  });
  const settings = useQuery(api.templates.getSettingsQuery);
  const [zipping, setZipping] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  const generatedRows = useMemo(
    () => (rows ?? []).filter((r) => r.certificateId),
    [rows],
  );

  const downloadZipAll = async () => {
    if (!job || !template || generatedRows.length === 0) return;
    setZipping(true);
    setProgressPct(0);
    try {
      const files: Array<{ name: string; blob: Blob }> = [];
      let done = 0;
      for (const row of generatedRows) {
        const certRow = await (async () => row)();
        const values: Record<string, string> = {};
        for (const f of (template.fields ?? []) as CertificateField[]) {
          if (f.type === "qr") continue;
          values[f.id] = certRow.values[f.id] ?? "";
        }
        const canvas = await renderForExport({
          renderUrl: template.renderUrl ?? "",
          assetWidth: template.assetWidth,
          assetHeight: template.assetHeight,
          fields: template.fields as CertificateField[],
          values,
          certificateId: certRow.certificateId!,
          showQr: settings?.showQrOnCertificates ?? true,
        });
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png"),
        );
        if (blob) {
          files.push({
            name: `${certRow.certificateId}.png`,
            blob,
          });
        }
        done++;
        setProgressPct(Math.round((done / generatedRows.length) * 100));
      }
      await downloadZip(files, `kudo-bulk-${job.templateName.replace(/\s+/g, "-").toLowerCase()}`);
      toast.success(`Downloaded ${files.length} certificates as ZIP.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the ZIP.");
    } finally {
      setZipping(false);
    }
  };

  if (job === undefined || rows === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (job === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Bulk job not found.</p>
        <Button variant="ghost" onClick={() => navigate("/bulk")}>
          <ArrowLeft className="mr-1 size-4" /> Back
        </Button>
      </div>
    );
  }

  const pct = job.totalRows > 0 ? Math.round((job.generatedCount / job.totalRows) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={`Bulk job · ${job.templateName}`}
        description={job.fileName ? `Source file: ${job.fileName}` : "Pasted rows"}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/bulk")}>
              <ArrowLeft className="mr-1 size-4" /> Bulk
            </Button>
            <Button
              onClick={() => void downloadZipAll()}
              disabled={zipping || generatedRows.length === 0}
            >
              {zipping ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" /> Rendering {progressPct}%
                </>
              ) : (
                <>
                  <Package className="mr-1.5 size-4" /> Download PNG ZIP
                </>
              )}
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <GlassPanel className="p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Total rows</p>
          <p className="mt-1 text-2xl font-bold">{job.totalRows}</p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Generated</p>
          <p className="mt-1 text-2xl font-bold text-success">{job.generatedCount}</p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Failed</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{job.failedCount}</p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Completed</p>
          <p className="mt-1 text-2xl font-bold">
            {job.completedAt ? formatDateTime(job.completedAt) : "—"}
          </p>
        </GlassPanel>
      </div>

      <GlassPanel className="mb-5 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{pct}% generated</span>
          <Badge
            variant={job.status === "completed" ? "secondary" : job.status === "failed" ? "destructive" : "outline"}
          >
            {job.status}
          </Badge>
        </div>
        <Progress value={pct} className="mt-2 h-2" />
      </GlassPanel>

      <GlassPanel className="p-4">
        <h2 className="mb-3 font-semibold">Rows</h2>
        <div className="max-h-[480px] overflow-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Row</TableHead>
                <TableHead>Certificate ID</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? [])
                .slice()
                .sort((a, b) => a.rowIndex - b.rowIndex)
                .slice(0, 500)
                .map((r) => {
                  const nameField =
                    (template?.fields ?? []).find(
                      (f) => /name/i.test(f.name),
                    ) ?? null;
                  const recipient = nameField
                    ? r.values[nameField.id] || "—"
                    : "—";
                  return (
                    <TableRow key={r._id}>
                      <TableCell className="font-mono text-xs">{r.rowIndex}</TableCell>
                      <TableCell className="font-mono text-xs">{r.certificateId ?? "—"}</TableCell>
                      <TableCell className="text-sm">{recipient}</TableCell>
                      <TableCell>
                        {r.status === "generated" ? (
                          <Badge variant="secondary">Generated</Badge>
                        ) : r.status === "failed" || r.status === "error" ? (
                          <Badge variant="destructive" title={r.errors.join("; ")}>
                            {r.status === "failed" ? "Failed" : "Invalid"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Valid</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.certificateId && (
                          <Link
                            to="/certificates"
                            className="text-xs text-primary hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </GlassPanel>
    </div>
  );
}
