import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  ImageDown,
  Link2,
  Loader2,
  Printer,
  QrCode,
  Send,
  Sparkles,
} from "lucide-react";
import { GlassPanel, PageHeader, EmptyState, formatDate } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PreviewCanvasLight,
} from "@/components/certificate-canvas";
import type { CertificateField } from "@/lib/certificate";
import { cn } from "@/lib/utils";

export default function CertificateCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("template");

  const templates = useQuery(api.templates.listTemplates);
  const settings = useQuery(api.templates.getSettingsQuery);
  const generate = useMutation(api.certificates.generateCertificate);

  const [templateId, setTemplateId] = useState<string | null>(preselect);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [customId, setCustomId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState<{ id: string; certificateId: string } | null>(null);

  useEffect(() => {
    if (!templateId && templates && templates.length > 0) {
      setTemplateId(templates[0]._id);
    }
  }, [templates, templateId]);

  const template = useMemo(
    () => templates?.find((t) => t._id === templateId) ?? null,
    [templates, templateId],
  );

  const fields: CertificateField[] = useMemo(
    () => (template?.fields ?? []).filter((f) => f.type !== "qr" && f.type !== "certificateId"),
    [template],
  );

  const missingRequired = fields.filter(
    (f) => f.required && !(values[f.id] ?? "").trim(),
  );
  const canGenerate =
    !!template && recipientName.trim().length > 0 && missingRequired.length === 0;

  const handleGenerate = async () => {
    if (!template || !canGenerate) return;
    setGenerating(true);
    try {
      const result = await generate({
        templateId: template._id as any,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        issueDate,
        values: fields.map((f) => ({
          key: f.id,
          label: f.name,
          value: (values[f.id] ?? "").trim(),
        })),
        customCertificateId: customId.trim() || undefined,
      });
      toast.success("Certificate generated!");
      setDone(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the certificate.");
    } finally {
      setGenerating(false);
    }
  };

  if (templates !== undefined && templates.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Generate certificate" />
        <GlassPanel>
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="No templates yet"
            description="Create a template first — then generating certificates takes under a minute."
            action={
              <Button asChild>
                <Link to="/templates/new">Create Template</Link>
              </Button>
            }
          />
        </GlassPanel>
      </div>
    );
  }

  if (done) {
    const verifyUrl = `${window.location.origin}/verify/${done.certificateId}`;
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Certificate generated" description="Share it, download it, or verify it publicly." />
        <GlassPanel strong className="p-7 text-center">
          <div className="glass-inset mx-auto mb-4 flex size-14 items-center justify-center rounded-full text-success">
            <CheckCircle2 className="size-7" />
          </div>
          <p className="font-mono text-xl font-bold tracking-tight">{done.certificateId}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued to {recipientName} · {formatDate(issueDate)}
          </p>

          <div className="mx-auto mt-5 max-w-xs rounded-xl bg-white p-3 shadow-sm">
            <QrCodeCanvas url={verifyUrl} className="size-full" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Scan to verify publicly</p>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
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
            <Button onClick={() => navigate(`/certificates/${done.id}`)}>
              <Send className="mr-1.5 size-4" /> Open & download
            </Button>
          </div>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => navigate("/certificates/new")}>
              Generate another
            </Button>
            <Button variant="ghost" onClick={() => navigate("/certificates")}>
              View all certificates
            </Button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Generate certificate"
        description="Fill the fields, preview the final design, then issue it."
        actions={
          <Button variant="ghost" onClick={() => navigate("/certificates")}>
            <ArrowLeft className="mr-1 size-4" /> Certificates
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <GlassPanel className="h-fit p-5">
          <div className="space-y-4">
            <div>
              <Label htmlFor="cc-template">Template</Label>
              <Select
                value={templateId ?? ""}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setValues({});
                }}
              >
                <SelectTrigger id="cc-template" className="glass-input mt-1.5">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {(templates ?? [])
                    .filter((t) => t.status !== "archived")
                    .map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cc-name">
                Recipient name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cc-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="glass-input mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="cc-email">
                Recipient email <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cc-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="name@example.com"
                className="glass-input mt-1.5"
              />
            </div>

            {fields.map((f) => (
              <div key={f.id}>
                <Label htmlFor={`cc-${f.id}`}>
                  {f.name}
                  {f.required && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  id={`cc-${f.id}`}
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                  value={values[f.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  placeholder={f.placeholder || `Enter ${f.name.toLowerCase()}`}
                  className="glass-input mt-1.5"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cc-date">Issue date</Label>
                <Input
                  id="cc-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="glass-input mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cc-id">
                  Custom ID <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="cc-id"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value.toUpperCase())}
                  placeholder={`${settings?.certificateIdPrefix ?? "KUDO"}-…`}
                  className="glass-input mt-1.5 font-mono text-sm"
                />
              </div>
            </div>

            {missingRequired.length > 0 && (
              <p className="text-xs text-destructive">
                Fill required fields: {missingRequired.map((f) => f.name).join(", ")}
              </p>
            )}

            <Button className="w-full" disabled={!canGenerate || generating} onClick={handleGenerate}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" /> Generate certificate
                </>
              )}
            </Button>
          </div>
        </GlassPanel>

        <div>
          <GlassPanel className="overflow-hidden p-4">
            {template ? (
              <PreviewWithId
                template={template}
                fields={template.fields ?? []}
                values={values}
                recipientName={recipientName}
                issueDate={issueDate}
                showQr={(settings?.showQrOnCertificates ?? true) === true}
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Select a template to preview.
              </div>
            )}
          </GlassPanel>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            This preview matches the exported PDF/PNG. The verification QR and certificate ID
            are added at generation time.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Preview with the recipient name auto-bound to the most name-like field. */
function PreviewWithId({
  template,
  fields,
  values,
  recipientName,
  issueDate,
  showQr,
}: {
  template: { renderUrl: string | null; assetWidth: number; assetHeight: number };
  fields: CertificateField[];
  values: Record<string, string>;
  recipientName: string;
  issueDate: string;
  showQr: boolean;
}) {
  const bound = useMemo(() => {
    const v = { ...values };
    const nameField = fields.find(
      (f) => /name/i.test(f.name) && f.type === "text",
    );
    if (nameField && recipientName) v[nameField.id] = recipientName;
    const dateField = fields.find((f) => f.type === "date");
    if (dateField && issueDate) v[dateField.id] = issueDate;
    return v;
  }, [fields, values, recipientName, issueDate]);

  return (
    <PreviewCanvasLight
      renderUrl={template.renderUrl}
      assetWidth={template.assetWidth}
      assetHeight={template.assetHeight}
      fields={fields}
      values={bound}
      certificateId="PREVIEW"
      showQr={showQr}
    />
  );
}

/** Standalone QR canvas (used on the success panel). */
export function QrCodeCanvas({ url, className }: { url: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { loadQrImage } = await import("@/lib/certificate");
      if (!ref.current || cancelled) return;
      const img = await loadQrImage(url);
      const ctx = ref.current.getContext("2d");
      if (!ctx) return;
      ref.current.width = 256;
      ref.current.height = 256;
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  return <canvas ref={ref} className={className} role="img" aria-label={`QR code for ${url}`} />;
}
