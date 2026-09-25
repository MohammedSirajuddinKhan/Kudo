import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Ban,
  BadgeCheck,
  Download,
  FileBadge,
  Layers,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassPanel, PageHeader, StatCard } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/files";

const PIE_COLORS = ["#5b7cfa", "#3fb0c9", "#8b5cf6", "#34b3a0", "#f59e0b", "#64748b"];

export default function Reports() {
  const reports = useQuery(api.audit.getReports);

  const exportIssuance = () => {
    if (!reports) return;
    downloadCsv(
      "kudo-issuance-report.csv",
      ["Month", "Certificates issued"],
      reports.issuedOverTime.map((m) => ({ Month: m.label, "Certificates issued": String(m.count) })),
    );
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Issuance trends, breakdowns and verification statistics."
        actions={
          <Button variant="outline" className="glass border-border/40" onClick={exportIssuance} disabled={!reports}>
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        }
      />

      {reports === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/40 dark:bg-white/10" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<FileBadge className="size-5" />}
              label="Certificates issued"
              value={reports.totals.issued}
              hint="All time"
            />
            <StatCard
              icon={<BadgeCheck className="size-5" />}
              label="Unique verified"
              value={reports.totals.verified}
              hint={`${reports.totals.verificationAttempts} total verification visits`}
            />
            <StatCard
              icon={<Ban className="size-5" />}
              label="Revoked"
              value={reports.totals.revoked}
              hint="Records preserved"
            />
            <StatCard
              icon={<Layers className="size-5" />}
              label="Bulk generated"
              value={reports.totals.bulkGenerated}
              hint={`${reports.totals.bulkJobs} jobs · ${reports.totals.bulkFailed} failed rows`}
            />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-5">
            <GlassPanel className="p-5 xl:col-span-3">
              <h2 className="mb-4 font-semibold">Certificates issued over time</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reports.issuedOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.08)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="rgba(30,41,59,0.4)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="rgba(30,41,59,0.4)" />
                    <ReTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(30,41,59,0.1)",
                        background: "rgba(255,255,255,0.9)",
                        backdropFilter: "blur(8px)",
                      }}
                    />
                    <Bar dataKey="count" name="Issued" radius={[6, 6, 0, 0]} fill="#5b7cfa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            <GlassPanel className="p-5 xl:col-span-2">
              <h2 className="mb-4 font-semibold">By category</h2>
              {reports.byCategory.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No data yet — issue some certificates first.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reports.byCategory}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {reports.byCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid rgba(30,41,59,0.1)",
                          background: "rgba(255,255,255,0.9)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <ul className="mt-2 space-y-1.5">
                {reports.byCategory.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="font-medium">{c.count}</span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </div>

          <GlassPanel className="mt-5 p-5">
            <h2 className="mb-4 font-semibold">Top templates</h2>
            {reports.byTemplate.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="space-y-3">
                {reports.byTemplate.map((t) => {
                  const max = reports.byTemplate[0]?.count || 1;
                  return (
                    <li key={t.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate font-medium">{t.name}</span>
                        <span className="text-muted-foreground">{t.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/50 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.max(4, (t.count / max) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassPanel>
        </>
      )}
    </div>
  );
}
