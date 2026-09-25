import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  ClipboardPaste,
  X,
} from "lucide-react";
import { GlassPanel, PageHeader, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  parseSpreadsheet,
  parsePastedText,
  type ParsedSheet,
} from "@/lib/files";
import { cn } from "@/lib/utils";

interface BulkRow {
  rowIndex: number;
  values: Record<string, string>;
  status: "valid" | "error" | "generated" | "failed";
  errors: string[];
  certificateId?: string;
}

type Stage = "setup" | "mapping" | "validating" | "generating" | "done";

const CHUNK = 25;

export default function BulkCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("template");
  const templates = useQuery(api.templates.listTemplates);
  const createJob = useMutation(api.bulk.createJob);
  const beginGeneration = useMutation(api.bulk.beginGeneration);
  const generateChunk = useMutation(api.bulk.generateChunk);
  const finishGeneration = useMutation(api.bulk.finishGeneration);

  const [stage, setStage] = useState<Stage>("setup");
  const [templateId, setTemplateId] = useState<string | null>(preselect);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState<string | undefined>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);

  const template = useMemo(
    () => templates?.find((t) => t._id === templateId) ?? null,
    [templates, templateId],
  );

  const templateFields = useMemo(
    () => (template?.fields ?? []).filter((f) => f.type !== "qr"),
    [template],
  );

  /** Best-guess column mapping via name similarity. */
  const autoMap = (columns: string[], fields: Array<{ id: string; name: string }>) => {
    const m: Record<string, string> = {};
    for (const f of fields) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const fn = norm(f.name);
      let best: string | undefined;
      let bestScore = 0;
      for (const c of columns) {
        const cn = norm(c);
        let score = 0;
        if (cn === fn) score = 3;
        else if (fn.includes(cn) || cn.includes(fn)) score = 2;
        else if (score === 0 && /name/.test(fn) && /name|recipient|student|participant/i.test(c)) score = 1.5;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best && bestScore > 0 && !Object.values(m).includes(best)) {
        m[f.id] = best;
      }
    }
    return m;
  };

  const buildRows = useCallback(
    (m: Record<string, string>): BulkRow[] => {
      if (!sheet || !template) return [];
      return sheet.rows.map((row, i) => {
        const values: Record<string, string> = {};
        const errors: string[] = [];
        for (const f of templateFields) {
          const col = m[f.id];
          const v = col ? (row[col] ?? "").trim() : "";
          values[f.id] = v;
          if (f.required && !v) {
            errors.push(`${f.name} is required`);
          }
          if (v && f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
            errors.push(`${f.name} is not a valid email`);
          }
        }
        // recipientName is special-cased in generation.
        const nameField = templateFields.find((f) => /name/i.test(f.name));
        if (nameField && !values[nameField.id]) {
          if (!errors.some((e) => e.includes(nameField.name))) {
            errors.push(`${nameField.name} is required`);
          }
        }
        if (!values["recipientName"]) values["recipientName"] = nameField ? values[nameField.id] ?? "" : "";
        return {
          rowIndex: i + 1,
          values,
          status: errors.length > 0 ? "error" : "valid",
          errors,
        };
      });
    },
    [sheet, template, templateFields],
  );

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.rows.length === 0) {
        toast.error("The file has no data rows.");
        return;
      }
      if (parsed.rows.length > 1000) {
        toast.error("Bulk import is limited to 1000 rows per job.");
        return;
      }
      setSheet(parsed);
      setFileName(file.name);
      if (template) {
        setMapping(autoMap(parsed.columns, templateFields));
      }
      setStage("mapping");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse the file.");
    }
  };

  const handlePaste = (text: string) => {
    try {
      const parsed = parsePastedText(text);
      if (parsed.rows.length === 0) {
        toast.error("Paste some rows first.");
        return;
      }
      setSheet(parsed);
      setFileName(undefined);
      if (template) {
        setMapping(autoMap(parsed.columns, templateFields));
      }
      setStage("mapping");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse the pasted data.");
    }
  };

  const validate = () => {
    const built = buildRows(mapping);
    setRows(built);
    setStage("validating");
  };

  const runGeneration = async () => {
    if (!template || rows.length === 0) return;
    const validRows = rows.filter((r) => r.status === "valid");
    if (validRows.length === 0) {
      toast.error("No valid rows to generate. Fix the errors first.");
      return;
    }
    setStage("generating");
    setProgress(2);
    try {
      const { jobId: jid, rowIds: createdRowIds } = await createJob({
        templateId: template._id as any,
        templateName: template.name,
        fileName,
        rows: validRows.map((r) => ({
          rowIndex: r.rowIndex,
          values: r.values,
          status: "valid" as const,
          errors: [],
        })),
      });
      setJobId(jid);
      await beginGeneration({ jobId: jid as any });
      // Chunked generation keeps each transaction small and the UI responsive.
      let done = 0;
      for (let i = 0; i < createdRowIds.length; i += CHUNK) {
        const chunk = createdRowIds.slice(i, i + CHUNK);
        await generateChunk({
          jobId: jid as any,
          rowIds: chunk as any,
        });
        done += chunk.length;
        setProgress(Math.round((done / createdRowIds.length) * 100));
      }
      await finishGeneration({ jobId: jid as any, success: true });
      setProgress(100);
      setStage("done");
      toast.success(`Generated ${createdRowIds.length} certificates.`);
    } catch (e) {
      setStage("validating");
      toast.error(e instanceof Error ? e.message : "Bulk generation failed.");
    }
  };

  const validCount = rows.filter((r) => r.status === "valid").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <div>
      <PageHeader
        title="Bulk generate"
        description="Import a spreadsheet, map the columns, validate, then generate in bulk."
      />

      {templates !== undefined && templates.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={<Layers className="size-6" />}
            title="No templates yet"
            description="Create a template first, then bulk generation takes a few clicks."
            action={
              <Button asChild>
                <Link to="/templates/new">Create Template</Link>
              </Button>
            }
          />
        </GlassPanel>
      ) : stage === "setup" || stage === "mapping" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <GlassPanel strong className="p-5">
            <h2 className="mb-4 font-semibold">1 · Choose a template & import data</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bulk-template">Template</Label>
                <Select
                  value={templateId ?? ""}
                  onValueChange={(v) => {
                    setTemplateId(v);
                    if (sheet) setMapping(autoMap(sheet.columns, templateFields));
                  }}
                >
                  <SelectTrigger id="bulk-template" className="glass-input mt-1.5">
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

              <label
                className={cn(
                  "glass-inset flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all",
                  "border-border/60 hover:border-primary/40",
                )}
              >
                <FileSpreadsheet className="mb-2 size-8 text-primary" />
                <p className="font-medium">Upload XLSX or CSV</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  First row = column headers · up to 1000 rows
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </label>

              <PasteBox onPaste={handlePaste} disabled={!template} />
            </div>
          </GlassPanel>

          <GlassPanel strong className="p-5">
            <h2 className="mb-4 font-semibold">2 · Map columns to fields</h2>
            {!template ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Choose a template to see its fields.
              </p>
            ) : !sheet ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Import a file or paste rows to map columns.
              </p>
            ) : (
              <div className="space-y-3.5">
                {templateFields.map((f) => (
                  <div key={f.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div>
                      <p className="truncate text-sm font-medium">
                        {f.name}
                        {f.required && <span className="text-destructive"> *</span>}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{f.type}</p>
                    </div>
                    <span className="text-muted-foreground">←</span>
                    <Select
                      value={mapping[f.id] ?? ""}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [f.id]: v === "__none" ? "" : v }))}
                    >
                      <SelectTrigger className="glass-input h-8">
                        <SelectValue placeholder="Skip" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Not mapped —</SelectItem>
                        {sheet.columns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {templateFields.length === 0 && (
                  <p className="text-sm text-destructive">
                    This template has no fields yet — edit it first.
                  </p>
                )}
                <Button className="w-full" disabled={templateFields.length === 0} onClick={validate}>
                  Validate rows
                </Button>
              </div>
            )}
          </GlassPanel>
        </div>
      ) : stage === "validating" ? (
        <GlassPanel strong className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">3 · Validation results</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-medium text-success">{validCount} valid rows</span>
                {errorCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-destructive">
                      {errorCount} rows need attention
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="glass border-border/40" onClick={() => setStage("mapping")}>
                Back to mapping
              </Button>
              <Button onClick={() => void runGeneration()} disabled={validCount === 0}>
                Generate {validCount} certificates
              </Button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  {templateFields.map((f) => (
                    <TableHead key={f.id}>{f.name}</TableHead>
                  ))}
                  <TableHead className="w-40">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) => (
                  <TableRow key={r.rowIndex} className={cn(errorCount > 0 && r.status === "error" && "bg-destructive/5")}>
                    <TableCell className="font-mono text-xs">{r.rowIndex}</TableCell>
                    {templateFields.map((f) => (
                      <TableCell key={f.id} className="max-w-40 truncate text-sm">
                        {r.values[f.id] || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                    <TableCell>
                      {r.status === "valid" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="size-3" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1" title={r.errors.join("; ")}>
                          <AlertTriangle className="size-3" /> {r.errors[0]}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > 200 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the first 200 of {rows.length} rows.
            </p>
          )}
        </GlassPanel>
      ) : stage === "generating" || stage === "done" ? (
        <GlassPanel strong className="p-8 text-center">
          {stage === "generating" ? (
            <>
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-4 font-medium">Generating certificates…</p>
              <Progress value={progress} className="mx-auto mt-4 h-2.5 max-w-md" />
              <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
            </>
          ) : (
            <>
              <div className="glass-inset mx-auto mb-4 flex size-14 items-center justify-center rounded-full text-success">
                <CheckCircle2 className="size-7" />
              </div>
              <h2 className="text-xl font-bold">Bulk generation complete</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {validCount} certificates issued with unique IDs and QR verification links.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                {jobId && (
                  <Button onClick={() => navigate(`/bulk/${jobId}`)}>
                    <Download className="mr-1.5 size-4" /> Open job & download ZIP
                  </Button>
                )}
                <Button variant="outline" className="glass border-border/40" onClick={() => navigate("/certificates")}>
                  View all certificates
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStage("setup");
                    setSheet(null);
                    setRows([]);
                    setProgress(0);
                  }}
                >
                  New bulk job
                </Button>
              </div>
            </>
          )}
        </GlassPanel>
      ) : null}
    </div>
  );
}

function PasteBox({ onPaste, disabled }: { onPaste: (t: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className="glass-inset rounded-xl p-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <ClipboardPaste className="size-4 text-primary" />
        Or paste rows (tab or comma separated)
      </button>
      {open && (
        <div className="mt-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Name\tCourse\tDate\tGrade\nRahul\tPython Workshop\t25 Sep 2026\tA+\nHinal\tAI Workshop\t25 Sep 2026\tA"}
            rows={5}
            className="glass-input font-mono text-xs"
            disabled={disabled}
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={disabled || !text.trim()}
              onClick={() => {
                onPaste(text);
                setOpen(false);
                setText("");
              }}
            >
              Use rows
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="mr-1 size-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
