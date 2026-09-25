import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Building2, Hash, QrCode, Save, Loader2, Info } from "lucide-react";
import { GlassPanel, PageHeader } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const settings = useQuery(api.templates.getSettingsQuery);
  const update = useMutation(api.audit.updateSettings);

  // null = not yet initialized; once server data arrives we snapshot the form.
  const [form, setForm] = useState<{
    orgName: string;
    prefix: string;
    padding: string;
    showQr: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize exactly once when the server data arrives (render-phase —
  // React re-renders immediately, no effect needed).
  if (form === null && settings !== undefined) {
    setForm({
      orgName: settings.organizationName,
      prefix: settings.certificateIdPrefix,
      padding: String(settings.certificateIdPadding),
      showQr: settings.showQrOnCertificates,
    });
  }

  const orgName = form?.orgName ?? "";
  const prefix = form?.prefix ?? "";
  const padding = form?.padding ?? "6";
  const showQr = form?.showQr ?? true;
  const setOrgName = (v: string) => setForm((f) => (f ? { ...f, orgName: v } : f));
  const setPrefix = (v: string) => setForm((f) => (f ? { ...f, prefix: v } : f));
  const setPadding = (v: string) => setForm((f) => (f ? { ...f, padding: v } : f));
  const setShowQr = (v: boolean) => setForm((f) => (f ? { ...f, showQr: v } : f));

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({
        organizationName: orgName,
        certificateIdPrefix: prefix,
        certificateIdPadding: parseInt(padding, 10) || 6,
        showQrOnCertificates: showQr,
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const idPreview = `${prefix.trim().toUpperCase() || "KUDO"}-${new Date().getFullYear()}-${"0".repeat(
    Math.max(0, (parseInt(padding, 10) || 6) - 1),
  )}1`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Your organization's issuing identity — applied to every certificate generated from here on."
      />

      {settings === undefined ? (
        <GlassPanel className="p-6">
          <div className="space-y-4">
            <div className="h-5 w-56 animate-pulse rounded-full bg-white/40 dark:bg-white/10" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-white/40 dark:bg-white/10" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-white/40 dark:bg-white/10" />
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-white/40 dark:bg-white/10" />
          </div>
        </GlassPanel>
      ) : (
        <div className="space-y-5">
          <GlassPanel className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="glass-inset flex size-10 items-center justify-center rounded-xl text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Organization</h2>
                <p className="text-xs text-muted-foreground">
                  Shown as the issuing institution on certificates and public verification pages.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Northgate Institute of Technology"
                className="glass-input"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                Certificates already issued keep the name they were issued under.
              </p>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="glass-inset flex size-10 items-center justify-center rounded-xl text-primary">
                <Hash className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Certificate IDs</h2>
                <p className="text-xs text-muted-foreground">
                  Every certificate gets a unique, verifiable ID in this format.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
              <div className="space-y-2">
                <Label htmlFor="prefix">ID prefix</Label>
                <Input
                  id="prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  placeholder="KUDO"
                  className="glass-input font-mono uppercase"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">1–10 letters or numbers.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="padding">Number padding</Label>
                <Input
                  id="padding"
                  type="number"
                  min={3}
                  max={10}
                  value={padding}
                  onChange={(e) => setPadding(e.target.value)}
                  className="glass-input"
                />
                <p className="text-xs text-muted-foreground">3–10 digits.</p>
              </div>
            </div>

            <div className="glass-inset mt-5 rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-wide">{idPreview}</p>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="glass-inset flex size-10 shrink-0 items-center justify-center rounded-xl text-primary">
                  <QrCode className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold">QR codes on new certificates</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add a scannable verification QR at the QR field position when generating.
                  </p>
                </div>
              </div>
              <Switch
                checked={showQr}
                onCheckedChange={setShowQr}
                aria-label="Toggle QR codes on certificates"
              />
            </div>
          </GlassPanel>

          <div className="flex items-center justify-end gap-2 pb-4">
            <Button onClick={handleSave} disabled={saving || !orgName.trim() || !prefix.trim()}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Save changes
            </Button>
          </div>

          <p className="flex items-start gap-2 pb-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            These settings apply to certificates generated after saving. Existing certificates
            are never altered — their IDs and issuer are snapshotted at issue time.
          </p>
        </div>
      )}
    </div>
  );
}
