import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Loader2,
  Mail,
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
import { emailCertificatePdf, type SendCertificatePdfFn } from "@/lib/email-delivery";
import type { CertificateField } from "@/lib/certificate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
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

export default function BulkJobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const job = useQuery(api.bulk.getJob, { jobId: jobId as any });
  const rows = useQuery(api.bulk.getJobRows, { jobId: jobId as any });
  const template = useQuery(api.templates.getTemplate, {
    id: (job?.templateId ?? "j") as any,
  });
  const settings = useQuery(api.templates.getSettingsQuery);
  const sendPdf = useAction(api.emails.sendCertificatePdf);
  const [zipping, setZipping] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  const generatedRows = useMemo(
    () => (rows ?? []).filter((r) => r.certificateId),
    [rows],
  );

  // Email delivery state for this job.
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<"each" | "one">("each");
  const [emailOne, setEmailOne] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [emailPct, setEmailPct] = useState(0);
  const [emailSent, setEmailSent] = useState(0);
  const [emailSkipped, setEmailSkipped] = useState(0);

  const templateFields = useMemo(
    () => (template?.fields ?? []) as CertificateField[],
    [template],
  );
  const emailField = useMemo(
    () => templateFields.find((f) => f.type === "email"),
    [templateFields],
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
      await downloadZip(files, `credora-bulk-${job.templateName.replace(/\s+/g, "-").toLowerCase()}`);
      toast.success(`Downloaded ${files.length} certificates as ZIP.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the ZIP.");
    } finally {
      setZipping(false);
    }
  };

  /**
   * Bulk email: render + send each generated row's PDF, one at a time.
   * "each" mode uses the row's email field value; "one" mode sends every
   * PDF to a single address (e.g. the registrar's office).
   */
  const emailAll = async () => {
    if (!job || !template || generatedRows.length === 0) return;
    const single = emailMode === "one" ? emailOne.trim() : "";
    if (emailMode === "one" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(single)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (emailMode === "each" && !emailField) {
      toast.error("This template has no email field to take addresses from.");
      return;
    }
    setEmailing(true);
    setEmailPct(0);
    setEmailSent(0);
    setEmailSkipped(0);
    let sentCount = 0;
    let skippedCount = 0;
    try {
      let done = 0;
      for (const row of generatedRows) {
        const values: Record<string, string> = {};
        for (const f of templateFields) {
          if (f.type === "qr") continue;
          values[f.id] = row.values[f.id] ?? "";
        }
        const to = emailMode === "each" ? (emailField ? (row.values[emailField.id] ?? "").trim() : "") : single;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          skippedCount++;
          setEmailSkipped(skippedCount);
          done++;
          setEmailPct(Math.round((done / generatedRows.length) * 100));
          continue;
        }
        const nameField = templateFields.find((f) => /name/i.test(f.name));
        await emailCertificatePdf(
          sendPdf as unknown as SendCertificatePdfFn,
          {
            certificateId: row.certificateId!,
            recipientName: nameField ? values[nameField.id] || row.certificateId! : row.certificateId!,
            renderUrl: template.renderUrl,
            assetWidth: template.assetWidth,
            assetHeight: template.assetHeight,
            fields: templateFields,
            values: templateFields
              .filter((f) => f.type !== "qr")
              .map((f) => ({ key: f.id, label: f.name, value: values[f.id] })),
          },
          to,
          settings?.organizationName ?? "",
          { bulk: true },
        );
        sentCount++;
        setEmailSent(sentCount);
        done++;
        setEmailPct(Math.round((done / generatedRows.length) * 100));
      }
      toast.success(
        `Emailed ${sentCount} PDF${sentCount === 1 ? "" : "s"}${skippedCount > 0 ? ` · ${skippedCount} skipped (no valid address)` : ""}`,
      );
      setEmailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk email failed partway.");
    } finally {
      setEmailing(false);
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
              variant="outline"
              className="glass border-border/40"
              disabled={generatedRows.length === 0}
              onClick={() => setEmailOpen(true)}
            >
              <Mail className="mr-1.5 size-4" /> Email PDFs
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

      <AlertDialog open={emailOpen} onOpenChange={setEmailOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email {generatedRows.length} certificate PDFs</AlertDialogTitle>
            <AlertDialogDescription>
              Each PDF is rendered exactly like the download and sent one-by-one — this runs
              in your browser, so keep the tab open until it finishes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {emailing ? (
            <div className="py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Sending… {emailPct}%</span>
                <span className="text-muted-foreground">
                  {emailSent} sent{emailSkipped > 0 ? ` · ${emailSkipped} skipped` : ""}
                </span>
              </div>
              <Progress value={emailPct} className="mt-2 h-2" />
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <RadioGroup
                value={emailMode}
                onValueChange={(v) => setEmailMode(v as "each" | "one")}
                className="gap-2.5"
              >
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                    emailMode === "each" ? "border-primary/40 bg-primary/8" : "border-border/60",
                  )}
                >
                  <RadioGroupItem value="each" className="mt-0.5" />
                  <span className="text-sm">
                    <span className="block font-medium">To each recipient</span>
                    <span className="text-muted-foreground">
                      {emailField
                        ? `Uses the “${emailField.name}” field on each row.`
                        : "No email field on this template — add one to use this mode."}
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                    emailMode === "one" ? "border-primary/40 bg-primary/8" : "border-border/60",
                  )}
                >
                  <RadioGroupItem value="one" className="mt-0.5" />
                  <span className="text-sm">
                    <span className="block font-medium">To one address</span>
                    <span className="text-muted-foreground">All PDFs attached to a single inbox.</span>
                  </span>
                </label>
              </RadioGroup>
              {emailMode === "one" && (
                <div>
                  <Label htmlFor="bulk-email-one">Send all PDFs to</Label>
                  <Input
                    id="bulk-email-one"
                    type="email"
                    value={emailOne}
                    onChange={(e) => setEmailOne(e.target.value)}
                    placeholder="registrar@yourdomain.com"
                    className="glass-input mt-1.5"
                    autoComplete="email"
                  />
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emailing}>Cancel</AlertDialogCancel>
            {!emailing && (
              <AlertDialogAction
                disabled={emailMode === "each" ? !emailField : !emailOne.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  void emailAll();
                }}
              >
                <Mail className="mr-2 size-4" />
                {emailMode === "each" ? "Send to each recipient" : "Send all to one address"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
