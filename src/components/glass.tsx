import { useTheme } from "next-themes";
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Credora wordmark with a layered glass badge. */
export function CredoraLogo({ size = 32, withText = true, className }: { size?: number; withText?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="glass inline-flex items-center justify-center rounded-xl text-primary"
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.58}
          height={size * 0.58}
          viewBox="0 0 512 512"
          fill="currentColor"
          aria-hidden="true"
        >
          {/* Document / credential frame */}
          <path d="M118 92 C118 72.118 134.118 56 154 56 H344 L304 136 H182 C158.804 136 140 154.804 140 178 V326 C140 344.778 152.348 361.56 170.096 368.201 L274 407 L232 447 L132 405 C99.449 391.28 78 359.112 78 323.5 V172 C78 136.654 94.076 105.009 118 92Z" />
          {/* Document text */}
          <rect x="190" y="194" width="150" height="25" rx="12.5" />
          <rect x="190" y="244" width="105" height="25" rx="12.5" />
          {/* Verification check */}
          <path d="M260 331 L304 369 L392 280 C407.464 264.536 432.536 264.536 448 280 C463.464 295.464 463.464 320.536 448 336 L330 454 C315.64 468.36 292.36 468.36 278 454 L218 394 C202.536 378.536 202.536 353.464 218 338 C229.716 326.284 248.284 326.284 260 331Z" />
        </svg>
      </span>
      {withText && (
        <span className="font-serif text-[1.15rem] font-bold tracking-tight text-foreground">
          Credora
        </span>
      )}
    </span>
  );
}

export function GlassPanel({
  children,
  className,
  strong = false,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-2xl",
        hover && "glass-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <GlassPanel hover className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            {icon}
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes resolves the theme on the client; SSR/first paint always shows
  // Moon, which is correct for the default light theme.
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/** Consistent page header for dashboard pages. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          {title}
          <span
            aria-hidden="true"
            className="mt-1.5 block h-0.5 w-10 rounded-full bg-gradient-to-r from-primary/80 to-chart-2/80"
          />
        </h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!y || !m || !d) return iso;
  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}
