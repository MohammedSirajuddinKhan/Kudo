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
import { GlassPanel } from "@/components/glass";

const PIE_COLORS = ["#5b7cfa", "#3fb0c9", "#8b5cf6", "#34b3a0", "#f59e0b", "#64748b"];

interface MonthlyPoint {
  label: string;
  count: number;
}

interface CategoryPoint {
  name: string;
  count: number;
}

/**
 * Chart panels for the Reports page. Kept in a separate module so recharts is
 * fetched lazily, only when this component is rendered.
 */
export default function ReportCharts({
  issuedOverTime,
  byCategory,
}: {
  issuedOverTime: MonthlyPoint[];
  byCategory: CategoryPoint[];
}) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-5">
      <GlassPanel className="p-5 xl:col-span-3">
        <h2 className="mb-4 font-semibold">Certificates issued over time</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={issuedOverTime}>
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
        {byCategory.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No data yet — issue some certificates first.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {byCategory.map((_, i) => (
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
          {byCategory.slice(0, 5).map((c, i) => (
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
  );
}
