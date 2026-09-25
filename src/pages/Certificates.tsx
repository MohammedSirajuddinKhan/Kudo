import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Ban,
  FileBadge,
  RotateCcw,
  Search,
  Eye,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { GlassPanel, PageHeader, EmptyState, formatDateTime } from "@/components/glass";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Certificates() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [templateId, setTemplateId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; certId: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);

  const certs = useQuery(api.certificates.listCertificates, {
    search: search || undefined,
    templateId: templateId === "all" ? undefined : (templateId as any),
    status: status === "all" ? undefined : (status as "active" | "revoked"),
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit: 500,
  });
  const templates = useQuery(api.templates.listTemplates);
  const revoke = useMutation(api.certificates.revokeCertificate);
  const reissue = useMutation(api.certificates.reissueCertificate);

  const handleRevoke = async () => {
    if (!revokeTarget || !revokeReason.trim()) return;
    setBusy(true);
    try {
      await revoke({ id: revokeTarget.id as any, reason: revokeReason.trim() });
      toast.success(`Certificate ${revokeTarget.certId} revoked. Public verification will show it.`);
      setRevokeTarget(null);
      setRevokeReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke the certificate.");
    } finally {
      setBusy(false);
    }
  };

  const handleReissue = async (id: string) => {
    setBusy(true);
    try {
      const r = await reissue({ id: id as any });
      toast.success(`Reissued as ${r.certificateId} using the latest template version.`);
      navigate(`/certificates/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reissue the certificate.");
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = templateId !== "all" || status !== "all" || fromDate || toDate;

  return (
    <div>
      <PageHeader
        title="Certificates"
        description="Every issued certificate, with verification status and actions."
        actions={
          <Button asChild>
            <Link to="/certificates/new">Generate certificate</Link>
          </Button>
        }
      />

      <GlassPanel className="mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, recipient or template…"
            aria-label="Search certificates"
            className="glass-input border-0 pl-9 shadow-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="glass-input h-9 w-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {(templates ?? []).map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="glass-input h-9 w-full lg:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="glass-input h-9"
              aria-label="Issue date from"
            />
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="glass-input h-9"
              aria-label="Issue date to"
            />
          </div>
        </div>
      </GlassPanel>

      {certs === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/40 dark:bg-white/10" />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={<FileBadge className="size-6" />}
            title={search || hasFilters ? "No certificates match" : "No certificates yet"}
            description={
              search || hasFilters
                ? "Try adjusting the search or filters."
                : "Generate your first certificate from a template — single or in bulk."
            }
            action={
              search || hasFilters ? undefined : (
                <Button asChild>
                  <Link to="/certificates/new">Generate certificate</Link>
                </Button>
              )
            }
          />
        </GlassPanel>
      ) : (
        <GlassPanel className="overflow-hidden p-2">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate ID</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map((c) => (
                  <TableRow key={c._id} className="cursor-pointer" onClick={() => navigate(`/certificates/${c._id}`)}>
                    <TableCell className="font-mono text-xs font-medium">{c.certificateId}</TableCell>
                    <TableCell className="text-sm font-medium">{c.recipientName}</TableCell>
                    <TableCell className="text-sm">{c.templateName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={c.status === "active" ? "secondary" : "destructive"}>
                          {c.status === "active" ? "Active" : "Revoked"}
                        </Badge>
                        {c.verifyCount > 0 && (
                          <span className="text-xs text-muted-foreground" title={`${c.verifyCount} verifications`}>
                            ✓{c.verifyCount}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${c.certificateId}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/certificates/${c._id}`)}>
                            <Eye className="mr-2 size-4" /> View & download
                          </DropdownMenuItem>
                          {c.status === "active" ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRevokeTarget({ id: c._id, certId: c.certificateId })}
                            >
                              <Ban className="mr-2 size-4" /> Revoke
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled={busy} onClick={() => void handleReissue(c._id)}>
                              <RotateCcw className="mr-2 size-4" /> Reissue (new ID)
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {certs.length >= 500 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Showing the 500 most recent certificates — refine filters to narrow down.
            </p>
          )}
        </GlassPanel>
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revokeTarget?.certId}?</AlertDialogTitle>
            <AlertDialogDescription>
              The record is preserved for audit purposes, and public verification will show
              CERTIFICATE REVOKED with your reason. This cannot be undone without reissuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-1">
            <Label htmlFor="revoke-reason">Reason (shown on the public verification page)</Label>
            <Input
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Issued in error"
              className="glass-input mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy || !revokeReason.trim()}
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
            >
              Revoke certificate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
