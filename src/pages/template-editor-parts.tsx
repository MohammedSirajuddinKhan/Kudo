import { useEffect, useRef, useState } from "react";
import {
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
import { GlassPanel } from "@/components/glass";
import { Button } from "@/components/ui/button";
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
import { FIELD_TYPE_LABELS, FONT_OPTIONS, renderCertificate, loadQrImage, loadImage } from "@/lib/certificate";
import { cn } from "@/lib/utils";

type Patch = Partial<CertificateField>;

/** Toolbar + page chrome wrapper for the editor. */
export function EditorChrome({
  templateName,
  version,
  dirty,
  onBack,
  onRunAi,
  aiBusy,
  hasFields,
  onSave,
  saving,
  mode,
  setMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  drawing,
  toggleDrawing,
  onAdd,
  showGrid,
  toggleGrid,
  zoom,
  setZoom,
  children,
}: {
  templateName: string;
  version: number;
  dirty: boolean;
  onBack: () => void;
  onRunAi: () => void;
  aiBusy: boolean;
  hasFields: boolean;
  onSave: () => void;
  saving: boolean;
  mode: "edit" | "preview";
  setMode: (m: "edit" | "preview") => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  drawing: boolean;
  toggleDrawing: () => void;
  onAdd: () => void;
  showGrid: boolean;
  toggleGrid: () => void;
  zoom: number;
  setZoom: (fn: (z: number) => number) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
            Edit: {templateName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Version {version}
            {dirty ? " · unsaved changes" : " · saved"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onBack}>
            Templates
          </Button>
          <Button variant="outline" className="glass border-border/40" onClick={onRunAi} disabled={aiBusy}>
            {aiBusy ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 size-4" />
            )}
            {hasFields ? "Re-run AI (replaces)" : "AI: detect fields"}
          </Button>
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-4" />
            )}
            Save
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Toolbar row under the header (exported separately for layout clarity). */
export function EditorToolbar(props: {
  mode: "edit" | "preview";
  setMode: (m: "edit" | "preview") => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  drawing: boolean;
  toggleDrawing: () => void;
  onAdd: () => void;
  showGrid: boolean;
  toggleGrid: () => void;
  zoom: number;
  setZoom: (fn: (z: number) => number) => void;
}) {
  return (
    <GlassPanel strong className="mb-3 flex flex-wrap items-center gap-1.5 p-2.5">
      <div className="flex items-center rounded-lg bg-white/40 p-0.5 dark:bg-white/10">
        <Button variant={props.mode === "edit" ? "secondary" : "ghost"} size="sm" onClick={() => props.setMode("edit")}>
          <Pencil className="mr-1 size-3.5" /> Edit
        </Button>
        <Button variant={props.mode === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => props.setMode("preview")}>
          <Eye className="mr-1 size-3.5" /> Preview
        </Button>
      </div>
      <div className="mx-1 h-6 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={props.onUndo} disabled={!props.canUndo} aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={props.onRedo} disabled={!props.canRedo} aria-label="Redo">
            <Redo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo</TooltipContent>
      </Tooltip>
      <div className="mx-1 h-6 w-px bg-border" />
      <Button variant={props.drawing ? "secondary" : "ghost"} size="sm" onClick={props.toggleDrawing}>
        <MousePointer2 className="mr-1 size-3.5" />
        {props.drawing ? "Click canvas…" : "Draw field"}
      </Button>
      <Button variant="ghost" size="sm" onClick={props.onAdd}>
        <Plus className="mr-1 size-3.5" /> Add
      </Button>
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={props.toggleGrid} aria-label="Toggle grid">
              <Grid3x3 className={cn("size-4", props.showGrid && "text-primary")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grid</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => props.setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(props.zoom * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => props.setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
      </div>
    </GlassPanel>
  );
}

/**
 * Live canvas preview: renders the base design + field values + QR through the
 * same engine used for exports, so preview matches output exactly.
 */
export function PreviewCanvas({
  renderUrl,
  assetWidth,
  assetHeight,
  fields,
  values,
  certificateId,
  verifyUrl,
  showQr,
}: {
  renderUrl: string | null;
  assetWidth: number;
  assetHeight: number;
  fields: CertificateField[];
  values: Record<string, string>;
  certificateId: string;
  verifyUrl: string;
  showQr: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLImageElement | null>(null);
  const [verifyBase, setVerifyBase] = useState("");

  useEffect(() => {
    setVerifyBase(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      if (!canvasRef.current || !renderUrl) return;
      try {
        if (showQr && !qrRef.current) {
          qrRef.current = await loadQrImage(verifyUrl);
        }
        if (cancelled) return;
        await renderCertificate(canvasRef.current, {
          imageUrl: renderUrl,
          assetWidth,
          assetHeight,
          fields,
          values,
          certificateId,
          verifyUrl: verifyUrl || `${verifyBase}/verify/${certificateId}`,
          showQr,
          qrImage: qrRef.current,
          testMode: true,
          scale: Math.min(1.2, 1400 / assetWidth),
        });
      } catch {
        // Render failures in preview are non-fatal; the canvas stays blank.
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [renderUrl, assetWidth, assetHeight, fields, values, certificateId, verifyUrl, showQr, verifyBase]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
      aria-label="Certificate preview"
    />
  );
}

/** Full inspector for the selected field. */
export function FieldInspector({
  field,
  assetH,
  onPatch,
  onHistory,
  onDuplicate,
  onDelete,
}: {
  field: CertificateField;
  assetH: number;
  onPatch: (patch: Patch) => void;
  onHistory: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const patch = (p: Patch) => {
    onHistory();
    onPatch(p);
  };

  if (field.type === "qr") {
    return (
      <GlassPanel className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">QR region</h2>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive" aria-label="Delete QR region">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This region receives the verification QR code at generation time. Position it where
          the design has clear space.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Field settings</h2>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label="Duplicate field">
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive" aria-label="Delete field">
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-3.5">
        <div>
          <Label htmlFor="f-name" className="text-xs">
            Field name
          </Label>
          <Input
            id="f-name"
            value={field.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            onBlur={onHistory}
            className="glass-input mt-1 h-8"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label className="text-xs">Type</Label>
            <Select
              value={field.type}
              onValueChange={(v) => patch({ type: v as CertificateField["type"] })}
            >
              <SelectTrigger className="glass-input mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as Array<keyof typeof FIELD_TYPE_LABELS>).map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Font</Label>
            <Select
              value={field.fontFamily}
              onValueChange={(v) => patch({ fontFamily: v })}
            >
              <SelectTrigger className="glass-input mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Font size</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(field.fontSize)}px
            </span>
          </div>
          <Slider
            value={[field.fontSize]}
            min={8}
            max={Math.max(40, Math.round(assetH * 0.09))}
            step={1}
            className="mt-2"
            onValueChange={([v]) => onPatch({ fontSize: v })}
            onValueCommit={onHistory}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label className="text-xs">Weight</Label>
            <Select
              value={String(field.fontWeight)}
              onValueChange={(v) => patch({ fontWeight: Number(v) })}
            >
              <SelectTrigger className="glass-input mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="400">Regular</SelectItem>
                <SelectItem value="600">Semibold</SelectItem>
                <SelectItem value="700">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <div className="mt-1 flex h-8 items-center gap-1.5">
              <input
                type="color"
                value={field.color}
                aria-label="Text color"
                className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                onChange={(e) => onPatch({ color: e.target.value })}
                onBlur={onHistory}
              />
              <Input
                value={field.color}
                onChange={(e) => onPatch({ color: e.target.value })}
                className="glass-input h-8 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Align</Label>
            <Select
              value={field.align}
              onValueChange={(v) => patch({ align: v as CertificateField["align"] })}
            >
              <SelectTrigger className="glass-input mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vertical</Label>
            <Select
              value={field.vAlign}
              onValueChange={(v) => patch({ vAlign: v as CertificateField["vAlign"] })}
            >
              <SelectTrigger className="glass-input mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="middle">Middle</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Caps</Label>
            <Select
              value={field.textTransform}
              onValueChange={(v) => patch({ textTransform: v as CertificateField["textTransform"] })}
            >
              <SelectTrigger className="glass-input mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="uppercase">UPPER</SelectItem>
                <SelectItem value="lowercase">lower</SelectItem>
                <SelectItem value="capitalize">Title</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Spacing</Label>
              <span className="text-xs text-muted-foreground">{field.letterSpacing.toFixed(1)}</span>
            </div>
            <Slider
              value={[field.letterSpacing]}
              min={-2}
              max={12}
              step={0.5}
              className="mt-2"
              onValueChange={([v]) => onPatch({ letterSpacing: v })}
              onValueCommit={onHistory}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Line height</Label>
              <span className="text-xs text-muted-foreground">{field.lineHeight.toFixed(2)}</span>
            </div>
            <Slider
              value={[field.lineHeight]}
              min={0.9}
              max={2.2}
              step={0.05}
              className="mt-2"
              onValueChange={([v]) => onPatch({ lineHeight: v })}
              onValueCommit={onHistory}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={field.autoFit} onCheckedChange={(v) => patch({ autoFit: v })} />
            Auto-fit
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={field.wrap} onCheckedChange={(v) => patch({ wrap: v })} />
            Wrap
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={field.italic} onCheckedChange={(v) => patch({ italic: v })} />
            Italic
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={field.underline} onCheckedChange={(v) => patch({ underline: v })} />
            Underline
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={field.required} onCheckedChange={(v) => patch({ required: v })} />
            Required
          </label>
        </div>

        <div className="glass-inset rounded-lg px-3 py-2 font-mono text-[11px] text-muted-foreground">
          x {field.x.toFixed(3)} · y {field.y.toFixed(3)} · w {field.width.toFixed(3)} · h{" "}
          {field.height.toFixed(3)}
        </div>
      </div>
    </GlassPanel>
  );
}
