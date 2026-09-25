import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScrollText, Search, ShieldCheck } from "lucide-react";
import { GlassPanel, PageHeader, EmptyState, formatDateTime } from "@/components/glass";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function describe(action: string): { label: string; tone: "default" | "secondary" | "destructive" | "outline" } {
  if (action.startsWith("certificate.created")) return { label: "Certificate issued", tone: "secondary" };
  if (action.startsWith("certificate.revoked")) return { label: "Certificate revoked", tone: "destructive" };
  if (action.startsWith("certificate.reissued")) return { label: "Certificate reissued", tone: "secondary" };
  if (action.startsWith("certificate.downloaded")) return { label: "Certificate downloaded", tone: "outline" };
  if (action.startsWith("template.created")) return { label: "Template created", tone: "default" };
  if (action.startsWith("template.edited")) return { label: "Template edited", tone: "default" };
  if (action.startsWith("template.duplicated")) return { label: "Template duplicated", tone: "default" };
  if (action.startsWith("template.archived")) return { label: "Template archived", tone: "outline" };
  if (action.startsWith("template.deleted")) return { label: "Template deleted", tone: "destructive" };
  if (action.startsWith("bulk.completed")) return { label: "Bulk completed", tone: "secondary" };
  if (action.startsWith("bulk.started") || action.startsWith("bulk.generation_started"))
    return { label: "Bulk started", tone: "default" };
  if (action.startsWith("bulk.failed")) return { label: "Bulk failed", tone: "destructive" };
  if (action.startsWith("ai.analyzed")) return { label: "AI analyzed", tone: "default" };
  if (action.startsWith("ai.analysis_failed")) return { label: "AI failed", tone: "outline" };
  if (action.startsWith("settings.changed")) return { label: "Settings changed", tone: "default" };
  return { label: action, tone: "outline" };
}

export default function AuditLogs() {
  const logs = useQuery(api.audit.listAuditLogs, { limit: 300 });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!logs) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.resourceType.toLowerCase().includes(q) ||
        (l.actorEmail ?? "").toLowerCase().includes(q),
    );
  }, [logs, search]);

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Append-only trail of every important action. Records cannot be edited or deleted from the app."
      />

      <GlassPanel className="mb-5 p-3">
        <div className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, resource or admin email…"
            aria-label="Search audit logs"
            className="glass-input border-0 pl-9 shadow-none"
          />
        </div>
      </GlassPanel>

      {filtered === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/40 dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={<ScrollText className="size-6" />}
            title="No activity recorded yet"
            description="Actions like creating templates, issuing certificates and revocations will appear here."
          />
        </GlassPanel>
      ) : (
        <GlassPanel className="p-2">
          <ul className="divide-y divide-border/60">
            {filtered.map((l) => {
              const d = describe(l.action);
              return (
                <li key={l._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3">
                  <Badge variant={d.tone} className="w-fit shrink-0 capitalize">
                    {d.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {l.resourceType}
                      {l.metadata && typeof l.metadata === "object" && "name" in (l.metadata as Record<string, unknown>) ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {String((l.metadata as Record<string, unknown>).name)}
                        </span>
                      ) : null}
                      {l.metadata && typeof l.metadata === "object" && "certificateId" in (l.metadata as Record<string, unknown>) ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {" "}
                          · {String((l.metadata as Record<string, unknown>).certificateId)}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.actorEmail ?? "system"} · {formatDateTime(l.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Showing the {filtered.length} most recent entries of the
            immutable log.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}
