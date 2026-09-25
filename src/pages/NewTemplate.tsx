import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { GlassPanel, PageHeader } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_MB, normalizeUpload, uploadToStorage } from "@/lib/files";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Participation Certificate",
  "Achievement Certificate",
  "Workshop Certificate",
  "Internship Certificate",
  "Competition Certificate",
  "Appreciation Certificate",
  "Course Certificate",
  "Custom Certificate",
];

type Stage = "upload" | "processing";

export default function NewTemplate() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [stage, setStage] = useState<Stage>("upload");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const createTemplate = useMutation(api.templates.createTemplate);
  const generateUploadUrl = useMutation(api.kudo.generateUploadUrl);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(f.type) && f.type !== "application/pdf") {
      toast.error("Unsupported format. Upload a JPG, JPEG, PNG, or PDF file.");
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setStage("upload");
  };

  const proceed = async (useAi: boolean) => {
    if (!file) return;
    setStage("processing");
    setProgress(5);
    setProgressLabel("Preparing the design…");
    try {
      const asset = await normalizeUpload(file);
      setProgress(20);
      setProgressLabel("Uploading the original file…");
      const originalStorageId = await uploadToStorage(file, () =>
        generateUploadUrl({ fileName: file.name }),
      );
      setProgress(45);
      setProgressLabel("Uploading the render asset…");
      const renderStorageId = await uploadToStorage(asset.renderBlob, () =>
        generateUploadUrl({ fileName: "render.png" }),
      );
      setProgress(70);
      setProgressLabel(useAi ? "Running AI analysis…" : "Creating template…");
      const templateId = await createTemplate({
        name: name.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        description: description.trim() || undefined,
        category,
        originalStorageId: originalStorageId as any,
        renderStorageId: renderStorageId as any,
        assetType: file.type === "application/pdf" ? "pdf" : "image",
        assetFileName: file.name,
        assetWidth: asset.renderWidth,
        assetHeight: asset.renderHeight,
        fields: [],
      });
      setProgress(90);
      navigate(`/templates/${templateId}/edit`, { state: { runAi: useAi } });
    } catch (e) {
      setStage("upload");
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Create template"
        description="Upload a certificate design — the original file is stored untouched."
        actions={
          <Button variant="ghost" onClick={() => navigate("/templates")}>
            <ArrowLeft className="mr-1 size-4" /> Back to templates
          </Button>
        }
      />

      <GlassPanel strong className="p-6 sm:p-8">
        {stage === "upload" ? (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload certificate design"
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "glass-inset flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all",
                dragOver ? "border-primary/60 bg-primary/5" : "border-border/60 hover:border-primary/40",
              )}
            >
              {previewUrl && file?.type === "application/pdf" ? (
                <FileUp className="size-10 text-primary" />
              ) : previewUrl ? (
                <img src={previewUrl} alt="Template preview" className="max-h-48 rounded-lg shadow-md" />
              ) : (
                <>
                  <div className="glass mb-3 flex size-12 items-center justify-center rounded-2xl text-primary">
                    <Upload className="size-6" />
                  </div>
                  <p className="font-medium">Drop your certificate design here</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    JPG, JPEG, PNG or PDF · up to {MAX_FILE_SIZE_MB} MB
                  </p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>

            {file && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{file.name}</span> ·{" "}
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="tpl-name" className="mb-1.5 block text-sm font-medium">
                  Template name
                </label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Workshop Participation 2026"
                  className="glass-input"
                />
              </div>
              <div>
                <label htmlFor="tpl-category" className="mb-1.5 block text-sm font-medium">
                  Category
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="tpl-category" className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="tpl-desc" className="mb-1.5 block text-sm font-medium">
                  Description <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="tpl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this template used for?"
                  className="glass-input"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" disabled={!file} onClick={() => void proceed(true)}>
                <Sparkles className="mr-1.5 size-4" />
                Analyze with AI & continue
              </Button>
              <Button
                variant="outline"
                className="glass flex-1 border-border/40"
                disabled={!file}
                onClick={() => void proceed(false)}
              >
                Skip AI — set fields manually
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              AI suggests fields automatically. You can always add, edit or remove fields in the
              editor — even if AI fails.
            </p>
          </>
        ) : (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 font-medium">Working…</p>
            <p className="mt-1 text-sm text-muted-foreground">{progressLabel}</p>
            <Progress value={progress} className="mx-auto mt-5 h-2 max-w-sm" />
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
