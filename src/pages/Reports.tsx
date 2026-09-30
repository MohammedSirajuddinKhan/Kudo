import { lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Ban,
  BadgeCheck,
  Download,
  FileBadge,
  Layers,
} from "lucide-react";
import { GlassPanel, PageHeader, StatCard } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/files";

// Recharts is ~400KB. It lives in its own chunk and is fetched only when the
// Reports page actually opens — every other page and the initial paint skip it.
const ReportCharts = lazy(() => import("./report-charts"));

export default function Reports() {
  const reports = useQuery(api.audit.getReports);

  const exportIssuance = () => {
    if (!reports) return;
    downloadCsv(
      "credora-issuance-report.csv",
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

          <Suspense
            fallback={
              <div className="mt-6 grid gap-5 xl:grid-cols-5">
                <div className="h-96 animate-pulse rounded-2xl bg-white/40 dark:bg-white/10 xl:col-span-3" />
                <div className="h-96 animate-pulse rounded-2xl bg-white/40 dark:bg-white/10 xl:col-span-2" />
              </div>
            }
          >
            <ReportCharts
              issuedOverTime={reports.issuedOverTime}
              byCategory={reports.byCategory}
            />
          </Suspense>

          <GlassPanel className="mt-5 p-5">
            <h2 className="mb-4 font-serif text-lg font-semibold">Top templates</h2>
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
                      <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-chart-2/90"
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
