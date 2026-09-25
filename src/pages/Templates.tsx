import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Copy,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { GlassPanel, PageHeader, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export default function Templates() {
  const templates = useQuery(api.templates.listTemplates);
  const categories = useQuery(api.templates.listCategories);
  const duplicate = useMutation(api.templates.duplicateTemplate);
  const remove = useMutation(api.templates.deleteTemplate);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!templates) return undefined;
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (t.status === "archived") return false;
      if (category !== "all" && t.category !== category) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [templates, search, category]);

  const handleDuplicate = async (id: string) => {
    setBusy(true);
    try {
      const newId = await duplicate({ templateId: id as any });
      toast.success("Template duplicated");
      navigate(`/templates/${newId}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate the template.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const result = await remove({ templateId: deleteTarget.id as any });
      if (result === "archived") {
        toast.info(
          "Template archived — it has certificates attached, so its history is preserved.",
        );
      } else {
        toast.success("Template deleted");
      }
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the template.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Reusable certificate designs. Upload any layout — Kudo maps the editable fields."
        actions={
          <Button asChild>
            <Link to="/templates/new">
              <Plus className="mr-1 size-4" />
              Create Template
            </Link>
          </Button>
        }
      />

      <GlassPanel className="mb-5 flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="glass-input border-0 pl-9 shadow-none"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="glass-input w-full border-0 shadow-none sm:w-52" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </GlassPanel>

      {filtered === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/40 dark:bg-white/10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={<LayoutTemplate className="size-6" />}
            title={search || category !== "all" ? "No templates match" : "No templates yet"}
            description={
              search || category !== "all"
                ? "Try a different search or category."
                : "Create your first certificate template by uploading a JPG, PNG, or PDF design."
            }
            action={
              search || category !== "all" ? undefined : (
                <Button asChild>
                  <Link to="/templates/new">Create Template</Link>
                </Button>
              )
            }
          />
        </GlassPanel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <GlassPanel key={t._id} hover className="flex flex-col overflow-hidden">
              <Link
                to={`/templates/${t._id}/edit`}
                className="block aspect-[1.414/1] overflow-hidden bg-white"
              >
                {t.renderUrl ? (
                  <img
                    src={t.renderUrl}
                    alt={`${t.name} preview`}
                    className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <LayoutTemplate className="size-8" />
                  </div>
                )}
              </Link>
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.category} · v{t.version} · {t.certificateCount ?? 0} issued
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${t.name}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/templates/${t._id}/edit`)}>
                      <Pencil className="mr-2 size-4" /> Edit fields
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={busy} onClick={() => handleDuplicate(t._id)}>
                      <Copy className="mr-2 size-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget({ id: t._id, name: t.name })}
                    >
                      <Trash2 className="mr-2 size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center justify-between px-4 pb-4">
                <Badge variant="secondary" className="capitalize">
                  {t.status}
                </Badge>
                <Button asChild size="sm" variant="outline" className="glass border-border/40">
                  <Link to={`/certificates/new?template=${t._id}`}>Generate</Link>
                </Button>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Templates with issued certificates are archived instead of deleted, so existing
              verifications keep working. This can't be undone for empty templates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
