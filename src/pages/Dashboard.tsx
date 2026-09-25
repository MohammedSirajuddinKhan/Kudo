import { Link } from "react-router";
import { useQuery } from "convex/react";
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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your certificate issuing activity."
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
            <Link key={a.to} to={a.to}>
              <GlassPanel hover className="flex items-center gap-3 p-4">
                <div className="glass-inset flex size-10 shrink-0 items-center justify-center rounded-xl text-primary">
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
            <h2 className="font-semibold">Recent certificates</h2>
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
                <div key={i} className="h-12 animate-pulse rounded-xl bg-white/40" />
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
            <ScrollText className="size-4 text-primary" />
            <h2 className="font-semibold">Recent activity</h2>
          </div>
          {activity === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-white/40" />
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
    </div>
  );
}
