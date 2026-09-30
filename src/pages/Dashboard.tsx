import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Activity,
  BadgeCheck,
  FileBadge,
  Layers,
  LayoutTemplate,
  Plus,
  QrCode,
  ScrollText,
  ShieldBan,
  Sparkles,
  BarChart3,
} from "lucide-react";
import {
  GlassPanel,
  PageHeader,
  StatCard,
  EmptyState,
  formatDateTime,
} from "@/components/glass";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const QUICK_ACTIONS = [
  { to: "/templates/new", label: "Create Template", icon: LayoutTemplate, desc: "Upload a design & map fields" },
  { to: "/certificates/new", label: "Generate Certificate", icon: Sparkles, desc: "Issue a single certificate" },
  { to: "/bulk", label: "Bulk Generate", icon: Layers, desc: "From XLSX, CSV or pasted rows" },
  { to: "/certificates", label: "View Certificates", icon: FileBadge, desc: "History, revoke & reissue" },
  { to: "/verify", label: "Verification", icon: QrCode, desc: "Public verification page" },
  { to: "/reports", label: "Reports", icon: BarChart3, desc: "Trends & breakdowns" },
];

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    "template.created": "Template created",
    "template.edited": "Template edited",
    "template.deleted": "Template deleted",
    "template.duplicated": "Template duplicated",
    "template.archived": "Template archived",
    "certificate.created": "Certificate issued",
    "certificate.revoked": "Certificate revoked",
    "certificate.reissued": "Certificate reissued",
    "certificate.downloaded": "Certificate downloaded",
    "bulk.started": "Bulk job created",
    "bulk.generation_started": "Bulk generation started",
    "bulk.completed": "Bulk generation completed",
    "bulk.failed": "Bulk generation failed",
    "ai.analyzed": "AI analyzed a template",
    "ai.analysis_failed": "AI analysis failed",
    "settings.changed": "Settings changed",
  };
  return map[action] ?? action;
}

export default function Dashboard() {
  const stats = useQuery(api.certificates.getStats);

  const activity = useQuery(api.certificates.getRecentActivity);
  const recentCerts = useQuery(api.certificates.listCertificates, { limit: 6 });
  const revokeCounts = useQuery(api.certificates.getRevokeCounts);
  const totalActive = revokeCounts?.totalActive ?? 0;
  const byTemplate = revokeCounts?.byTemplate ?? [];

  const cards = [
    {
      icon: <LayoutTemplate className="size-5" />,
      label: "Total templates",
      value: stats?.totalTemplates ?? "—",
      hint: "Reusable certificate designs",
    },
    {
      icon: <FileBadge className="size-5" />,
      label: "Certificates issued",
      value: stats?.certificatesIssued ?? "—",
      hint: "All time",
    },
    {
      icon: <BadgeCheck className="size-5" />,
      label: "Certificates verified",
      value: stats?.certificatesVerified ?? "—",
      hint: "Unique IDs verified publicly",
    },
    {
      icon: <Activity className="size-5" />,
      label: "Issued this month",
      value: stats?.certificatesThisMonth ?? "—",
      hint: "Current calendar month",
    },
  ];

  const revoke = useMutation(api.certificates.revokeCertificate);
  const revokeAll = useMutation(api.certificates.revokeAllCertificates);
  const revokeByTemplate = useMutation(api.certificates.revokeCertificatesByTemplate);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeMode, setRevokeMode] = useState<"all" | "template" | "single">("all");
  const [revokeTemplateId, setRevokeTemplateId] = useState<string>("");
  const [revokeCertId, setRevokeCertId] = useState<string>("all");
  const [revokeReason, setRevokeReason] = useState("Reason supplied via dashboard bulk revoke");
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load the certificate list only while the single-revoke dialog is open.
  const activeCerts = useQuery(
    api.certificates.listCertificates,
    confirmOpen && revokeMode === "single"
      ? { status: "active" as const, limit: 500 }
      : "skip",
  );
  // Keep the picker on a real certificate (pre-select the newest on open).
  useEffect(() => {
    if (activeCerts && activeCerts.length > 0 && !activeCerts.some((c) => c._id === revokeCertId)) {
      setRevokeCertId(activeCerts[0]._id);
    }
  }, [activeCerts, revokeCertId]);

  const handleRevoke = async () => {
    setRevokeBusy(true);
    try {
      if (revokeMode === "all") {
        const r = await revokeAll({ reason: revokeReason.trim() });
        toast.success(`Revoked ${r.revoked} certificate${r.revoked === 1 ? "" : "s"}.`);
      } else if (revokeMode === "template") {
        const r = await revokeByTemplate({
          templateId: revokeTemplateId as any,
          reason: revokeReason.trim(),
        });
        toast.success(`Revoked ${r.revoked} certificate${r.revoked === 1 ? "" : "s"} from that template.`);
      } else {
        if (!revokeCertId || revokeCertId === "all") return;
        await revoke({ id: revokeCertId as any, reason: revokeReason.trim() });
        toast.success("Certificate revoked.");
      }
      setRevokeOpen(false);
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke the certificates.");
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your certificate issuing activity."
        actions={
          <DropdownMenu open={revokeOpen} onOpenChange={setRevokeOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="glass border-destructive/40 text-destructive"
                disabled={totalActive === 0}
                aria-label="Revoke certificates"
              >
                <ShieldBan className="mr-1.5 size-4" />
                Revoke certificates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Revoke certificates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={totalActive === 0}
                onClick={() => {
                  setRevokeMode("all");
                  setConfirmOpen(true);
                }}
              >
                <ShieldBan className="mr-2 size-4 text-destructive" />
                Revoke ALL ({totalActive} active)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={byTemplate.length === 0}
                onClick={() => {
                  setRevokeMode("template");
                  setConfirmOpen(true);
                }}
              >
                <LayoutTemplate className="mr-2 size-4" />
                Revoke by template…
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={totalActive === 0}
                onClick={() => {
                  setRevokeMode("single");
                  setConfirmOpen(true);
                }}
              >
                <FileBadge className="mr-2 size-4" />
                Revoke a single certificate…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} hint={c.hint} delay={i * 0.06} />
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className="group">
              <GlassPanel hover className="flex items-center gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary/18">
                  <a.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.desc}</p>
                </div>
              </GlassPanel>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-5 xl:grid-cols-5">
        <GlassPanel className="p-5 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Recent certificates</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/certificates">
                View all
                <Plus className="ml-1 size-3.5 rotate-45" />
              </Link>
            </Button>
          </div>
          {recentCerts === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-white/40 dark:bg-white/10" />
              ))}
            </div>
          ) : recentCerts.length === 0 ? (
            <EmptyState
              icon={<FileBadge className="size-6" />}
              title="No certificates yet"
              description="Create a template first, then generate your first certificate."
              action={
                <Button asChild>
                  <Link to="/templates/new">Create Template</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {recentCerts.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.recipientName}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {c.certificateId} · {c.templateName}
                    </p>
                  </div>
                  <Badge
                    variant={c.status === "active" ? "secondary" : "destructive"}
                    className="shrink-0"
                  >
                    {c.status === "active" ? "Active" : "Revoked"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="size-4 text-chart-2" />
            <h2 className="font-serif text-lg font-semibold">Recent activity</h2>
          </div>
          {activity === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-white/40 dark:bg-white/10" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Actions like issuing certificates will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a._id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0">
                    <p className="leading-snug">{actionLabel(a.action)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          {revokeMode === "single" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke a certificate</AlertDialogTitle>
                <AlertDialogDescription>
                  Records are preserved and public verification will show CERTIFICATE REVOKED
                  with your reason. This cannot be undone without reissuing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 py-1">
                <div>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">Certificate</Label>
                  <Select value={revokeCertId} onValueChange={setRevokeCertId} disabled={!activeCerts || activeCerts.length === 0}>
                    <SelectTrigger className="glass-input w-full">
                      <SelectValue placeholder="Choose a certificate" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(activeCerts ?? []).map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.certificateId} — {c.recipientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">Reason (shown publicly)</Label>
                  <Input
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="e.g. Issued in error"
                    className="glass-input"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={revokeBusy || !revokeCertId || revokeCertId === "all" || !revokeReason.trim()}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleRevoke();
                  }}
                >
                  Revoke certificate
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : revokeMode === "template" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke certificates by template</AlertDialogTitle>
                <AlertDialogDescription>
                  Every active certificate from the selected template is revoked. Records are
                  preserved; public verification shows CERTIFICATE REVOKED.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 py-1">
                <div>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">Template</Label>
                  <Select value={revokeTemplateId} onValueChange={setRevokeTemplateId} disabled={byTemplate.length === 0}>
                    <SelectTrigger className="glass-input w-full">
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {byTemplate.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.active} active)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">Reason (shown publicly)</Label>
                  <Input
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="e.g. Course retracted"
                    className="glass-input"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={revokeBusy || !revokeTemplateId || !revokeReason.trim()}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleRevoke();
                  }}
                >
                  Revoke all from template
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke ALL active certificates?</AlertDialogTitle>
                <AlertDialogDescription>
                  This revokes every currently active certificate across all templates.
                  Records are preserved and public verification will show CERTIFICATE
                  REVOKED with your reason. This cannot be undone without reissuing each one.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Reason (shown publicly)</Label>
                <Input
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Credentials re-issued under a new program"
                  className="glass-input"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={revokeBusy || !revokeReason.trim()}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleRevoke();
                  }}
                >
                  Revoke all {totalActive} certificates
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
