import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Copy,
  Eye,
  Grid3x3,
  Loader2,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { GlassPanel, PageHeader } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CertificateField } from "@/lib/certificate";
import { DEFAULT_FONT } from "@/lib/certificate";
import { EditorChrome, EditorToolbar, PreviewCanvas, FieldInspector } from "./template-editor-parts";
import { cn } from "@/lib/utils";

function makeField(id: string, x: number, y: number, height: number, index: number): CertificateField {
  return {
    id,
    name: `Field ${index}`,
    type: "text",
    x,
    y,
    width: 0.3,
    height,
    fontSize: 28,
    fontFamily: DEFAULT_FONT,
    fontWeight: 400,
    italic: false,
    underline: false,
    color: "#1a1a2e",
    align: "center",
    vAlign: "middle",
    letterSpacing: 0,
    lineHeight: 1.2,
    textTransform: "none",
    autoFit: true,
    wrap: false,
    required: false,
    source: "manual",
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const template = useQuery(api.templates.getTemplate, { id: id as any });
  const saveFields = useMutation(api.templates.saveTemplateFields);
  const analyze = useAction(api.ai.analyzeTemplate);

  const [fields, setFields] = useState<CertificateField[] | null>(null);
  const [undoStack, setUndoStack] = useState<CertificateField[][]>([]);
  const [redoStack, setRedoStack] = useState<CertificateField[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    fieldId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    dragMode: "move" | "resize";
  } | null>(null);

  useEffect(() => {
    if (template && fields === null) {
      setFields(template.fields ?? []);
      setName(template.name);
    }
  }, [template, fields]);

  const pushHistory = useCallback(() => {
    setFields((cur) => {
      if (cur) setUndoStack((h) => [...h.slice(-40), JSON.parse(JSON.stringify(cur))]);
      return cur;
    });
    setRedoStack([]);
    setDirty(true);
  }, []);

  const updateField = (fieldId: string, patch: Partial<CertificateField>) => {
    setFields((prev) =>
      prev ? prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) : prev,
    );
  };

  const selected = useMemo(
    () => fields?.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  const assetW = template?.assetWidth ?? 1600;
  const assetH = template?.assetHeight ?? 1131;
  const displayW = Math.min(760, assetW);

  const startDrag = (e: React.PointerEvent, fieldId: string, m: "move" | "resize") => {
    const field = fields?.find((f) => f.id === fieldId);
    if (!field) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pushHistory();
    dragState.current = {
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      origW: field.width,
      origH: field.height,
      dragMode: m,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const wrap = canvasWrapRef.current;
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      const dx = (e.clientX - ds.startX) / (r.width * zoom);
      const dy = (e.clientY - ds.startY) / (r.height * zoom);
      setFields((prev) => {
        if (!prev) return prev;
        return prev.map((f) => {
          if (f.id !== ds.fieldId) return f;
          if (ds.dragMode === "move") {
            return {
              ...f,
              x: Math.min(1 - f.width, Math.max(0, ds.origX + dx)),
              y: Math.min(1 - f.height, Math.max(0, ds.origY + dy)),
            };
          }
          return {
            ...f,
            width: Math.min(1 - f.x, Math.max(0.02, ds.origW + dx)),
            height: Math.min(1 - f.y, Math.max(0.01, ds.origH + dy)),
          };
        });
      });
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [zoom]);

  const undo = () => {
    setUndoStack((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFields((cur) => {
        if (cur) setRedoStack((f) => [...f, JSON.parse(JSON.stringify(cur))]);
        return prev;
      });
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setFields((cur) => {
        if (cur) setUndoStack((h) => [...h, JSON.parse(JSON.stringify(cur))]);
        return next;
      });
      return f.slice(0, -1);
    });
  };

  const addField = () => {
    if (!fields) return;
    pushHistory();
    const nf = makeField(`manual-${Date.now()}`, 0.32, 0.45, 0.055, fields.length + 1);
    setFields([...fields, nf]);
    setSelectedId(nf.id);
  };

  const duplicateField = () => {
    if (!fields || !selected) return;
    pushHistory();
    const copy = {
      ...clone(selected),
      id: `manual-${Date.now()}`,
      name: `${selected.name} copy`,
      x: Math.min(0.98 - selected.width, selected.x + 0.02),
      y: Math.min(0.98 - selected.height, selected.y + 0.03),
      source: "manual" as const,
      confidence: undefined,
    };
    setFields([...fields, copy]);
    setSelectedId(copy.id);
  };

  const deleteField = () => {
    if (!fields || !selected) return;
    pushHistory();
    setFields(fields.filter((f) => f.id !== selected.id));
    setSelectedId(null);
  };

  const runAi = async () => {
    if (!template || !fields) return;
    setAiBusy(true);
    try {
      const result = await analyze({ templateId: id as any });
      if (result.ok && result.fields && result.fields.length > 0) {
        pushHistory();
        setFields(result.fields);
        setSelectedId(null);
        toast.success(`AI suggested ${result.fields.length} fields — review and adjust.`);
      } else {
        toast.error(result.error ?? "AI could not detect fields. Draw them manually.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI analysis failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async () => {
    if (!fields || !template) return;
    for (const f of fields) {
      if (!f.name.trim()) {
        toast.error("Every field needs a name.");
        return;
      }
    }
    setSaving(true);
    try {
      await saveFields({
        templateId: id as any,
        fields: fields.map((f) => ({ ...f, placeholder: f.placeholder || undefined })),
        name: name.trim() || template.name,
      });
      setDirty(false);
      toast.success("Template saved. New certificates will use this version.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the template.");
    } finally {
      setSaving(false);
    }
  };

  const drawStart = (e: React.PointerEvent) => {
    if (!drawing || !fields) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = Math.min(0.98, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(0.98, Math.max(0, (e.clientY - rect.top) / rect.height));
    pushHistory();
    const nf = makeField(`manual-${Date.now()}`, x, y, 0.05, fields.length + 1);
    setFields([...fields, nf]);
    setSelectedId(nf.id);
    setDrawing(false);
  };

  const editorRef = useRef<{ runAi: () => Promise<void> }>({ runAi: async () => {} });
  editorRef.current.runAi = runAi;

  // Auto-run AI when arriving from the wizard with runAi=true.
  const aiRanRef = useRef(false);
  useEffect(() => {
    const state = window.history.state?.usr as { runAi?: boolean } | undefined;
    if (template && fields !== null && state?.runAi && !aiRanRef.current) {
      aiRanRef.current = true;
      void editorRef.current.runAi();
      window.history.replaceState(
        { ...window.history.state, usr: { ...state, runAi: false } },
        "",
      );
    }
  }, [template, fields]);

  if (template === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (template === null || fields === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Template not found.</p>
        <Button variant="ghost" onClick={() => navigate("/templates")}>
          <ArrowLeft className="mr-1 size-4" /> Back to templates
        </Button>
      </div>
    );
  }

  const textFields = fields;
  const qrField = textFields.find((f) => f.type === "qr");

  return (
    <EditorChrome
      templateName={name || template.name}
      version={template.version}
      dirty={dirty}
      onBack={() => navigate("/templates")}
      onRunAi={() => void runAi()}
      aiBusy={aiBusy}
      hasFields={textFields.length > 0}
      onSave={() => void handleSave()}
      saving={saving}
      mode={mode}
      setMode={setMode}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
      drawing={drawing}
      toggleDrawing={() => setDrawing((d) => !d)}
      onAdd={addField}
      showGrid={showGrid}
      toggleGrid={() => setShowGrid((g) => !g)}
      zoom={zoom}
      setZoom={setZoom}
    >
      <EditorToolbar
        mode={mode}
        setMode={setMode}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        drawing={drawing}
        toggleDrawing={() => setDrawing((d) => !d)}
        onAdd={addField}
        showGrid={showGrid}
        toggleGrid={() => setShowGrid((g) => !g)}
        zoom={zoom}
        setZoom={setZoom}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* Canvas column */}
        <div className="min-w-0">
          <GlassPanel className="overflow-hidden p-4">
            <div
              ref={canvasWrapRef}
              data-canvas-wrap
              className={cn(
                "editor-canvas relative mx-auto select-none overflow-hidden rounded-lg bg-white",
                drawing && "cursor-crosshair",
              )}
              style={{
                width: "100%",
                maxWidth: Math.round(displayW * zoom),
                aspectRatio: `${assetW} / ${assetH}`,
              }}
              onPointerDown={drawStart}
            >
              {template.renderUrl && (
                <img
                  src={template.renderUrl}
                  alt="Certificate base layer"
                  className="absolute inset-0 size-full object-fill"
                  draggable={false}
                />
              )}
              {showGrid && (
                <div className="glass-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
              )}
              {mode === "edit" ? (
                <>
                  {textFields.map((f, idx) => {
                    const isSel = f.id === selectedId;
                    return (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Field ${f.name}`}
                        className={cn(
                          "absolute rounded-[3px] border transition-colors",
                          isSel
                            ? "border-2 border-primary bg-primary/10"
                            : "border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10",
                        )}
                        style={{
                          left: `${f.x * 100}%`,
                          top: `${f.y * 100}%`,
                          width: `${f.width * 100}%`,
                          height: `${f.height * 100}%`,
                        }}
                        onPointerDown={(e) => {
                          if (drawing) return;
                          setSelectedId(f.id);
                          startDrag(e, f.id, "move");
                        }}
                        onKeyDown={() => setSelectedId(f.id)}
                      >
                        <span
                          className={cn(
                            "pointer-events-none absolute -top-0.5 left-0 max-w-full truncate rounded-br-md rounded-tl-md px-1.5 text-[10px] font-medium leading-4 text-white",
                            isSel ? "bg-primary" : "bg-primary/80",
                          )}
                        >
                          {idx + 1}. {f.name}
                        </span>
                        {f.source === "ai" && (
                          <span className="pointer-events-none absolute -top-0.5 right-0 rounded-bl-md rounded-tr-md bg-chart-2/90 px-1 text-[9px] font-semibold leading-4 text-white">
                            AI {Math.round((f.confidence ?? 0) * 100)}%
                          </span>
                        )}
                        <span
                          className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow"
                          onPointerDown={(e) => startDrag(e, f.id, "resize")}
                          aria-hidden="true"
                        />
                      </div>
                    );
                  })}
                  {textFields.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="glass-strong rounded-xl px-5 py-3 text-center text-sm">
                        <p className="font-medium">No fields yet</p>
                        <p className="mt-0.5 text-muted-foreground">
                          Run AI detection, draw a field, or add one.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <PreviewCanvas
                  renderUrl={template.renderUrl}
                  assetWidth={assetW}
                  assetHeight={assetH}
                  fields={textFields}
                  values={testValues}
                  certificateId="KUDO-0000-TEST"
                  verifyUrl={`${window.location.origin}/verify/KUDO-0000-TEST`}
                  showQr={true}
                />
              )}
            </div>
          </GlassPanel>
          {mode === "preview" && (
            <GlassPanel className="mt-3 p-4 text-sm text-muted-foreground">
              Preview renders live with test data — exactly what exported certificates look like.
              Enter sample values below.
            </GlassPanel>
          )}
        </div>

        {/* Inspector column */}
        <div className="space-y-4">
          {mode === "preview" && valueFields(textFields).length > 0 && (
            <GlassPanel className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Test data</h2>
              <div className="space-y-2.5">
                {valueFields(textFields).map((f) => (
                  <div key={f.id}>
                    <Label htmlFor={`test-${f.id}`} className="text-xs">
                      {f.name}
                    </Label>
                    <Input
                      id={`test-${f.id}`}
                      value={testValues[f.id] ?? ""}
                      onChange={(e) =>
                        setTestValues((v) => ({ ...v, [f.id]: e.target.value }))
                      }
                      placeholder={f.type === "date" ? "2026-09-25" : `Sample ${f.name}`}
                      className="glass-input mt-1 h-8"
                    />
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}

          <GlassPanel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Fields <span className="text-muted-foreground">({textFields.length})</span>
              </h2>
              <Button size="sm" variant="ghost" onClick={addField}>
                <Plus className="mr-1 size-3.5" /> Add
              </Button>
            </div>
            {textFields.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">No fields yet.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {textFields.map((f, idx) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(f.id);
                        setMode("edit");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                        f.id === selectedId ? "glass-strong font-medium" : "hover:bg-white/40",
                      )}
                    >
                      <span className="w-4 shrink-0 text-xs text-muted-foreground">{idx + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      {f.source === "ai" && (
                        <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                          AI
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          {selected && mode === "edit" && (
            <FieldInspector
              field={selected}
              assetH={assetH}
              onPatch={(patch: Partial<CertificateField>) => updateField(selected.id, patch)}
              onHistory={pushHistory}
              onDuplicate={duplicateField}
              onDelete={deleteField}
            />
          )}

          {qrField && (
            <GlassPanel className="p-4">
              <p className="text-sm font-medium">QR verification region</p>
              <p className="mt-1 text-xs text-muted-foreground">
                “{qrField.name}” receives a scannable QR code pointing to each certificate's
                public verification page when certificates are generated.
              </p>
            </GlassPanel>
          )}
        </div>
      </div>
    </EditorChrome>
  );
}

function valueFields(fields: CertificateField[]) {
  return fields.filter((f) => f.type !== "qr");
}
