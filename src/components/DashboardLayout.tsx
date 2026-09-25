import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import {
  BarChart3,
  Bell,
  FileBadge,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GlassPanel, KudoLogo, ThemeToggle } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/templates", label: "Templates", icon: LayoutTemplateIcon },
  { to: "/certificates", label: "Certificates", icon: FileBadge },
  { to: "/certificates/new", label: "Generate", icon: Sparkles, exact: true },
  { to: "/bulk", label: "Bulk Generate", icon: Layers },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

function LayoutTemplateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/certificates?q=${encodeURIComponent(q)}`);
    setSearch("");
    setMobileOpen(false);
  };

  const navLinks = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "glass-strong text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5",
            )
          }
        >
          <item.icon className="size-4.5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const initials = (user?.name || user?.email || "A")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1400px] gap-5 px-4 py-4 lg:px-6">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 lg:block">
          <GlassPanel className="flex h-full flex-col p-4">
            <Link to="/" className="mb-6 px-1">
              <KudoLogo />
            </Link>
            {navLinks}
            <div className="mt-auto">
              <div className="glass-inset rounded-xl p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">Recipients need no account</p>
                <p className="mt-1">
                  Share a certificate link or QR — anyone can verify it on the public page.
                </p>
              </div>
            </div>
          </GlassPanel>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <GlassPanel strong className="mb-5 flex items-center gap-2 px-3 py-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <Link to="/" className="lg:hidden">
              <KudoLogo withText={false} />
            </Link>
            <form onSubmit={handleSearch} className="relative flex-1" role="search">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search certificates by ID, recipient or template…"
                aria-label="Search certificates"
                className="glass-input border-0 pl-9 shadow-none focus-visible:ring-1"
              />
            </form>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="View verification page"
                onClick={() => navigate("/verify")}
              >
                <Bell className="size-4" />
              </Button>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
                    <span className="glass-inset flex size-8 items-center justify-center rounded-full text-xs font-bold text-primary">
                      {initials || "A"}
                    </span>
                    <span className="hidden max-w-28 truncate text-sm md:inline">
                      {user?.name || user?.email || "Admin"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-medium">{user?.email || "Administrator"}</p>
                    <p className="text-xs font-normal text-muted-foreground">Administrator</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <UserRound className="mr-2 size-4" /> Account & settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/verify")}>
                    <Bell className="mr-2 size-4" /> Public verification
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </GlassPanel>

          {/* Mobile nav */}
          {mobileOpen && (
            <GlassPanel className="mb-5 p-3 lg:hidden">
              {navLinks}
            </GlassPanel>
          )}

          <main className="pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
