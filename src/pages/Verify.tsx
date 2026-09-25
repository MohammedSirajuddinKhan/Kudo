import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  FileWarning,
  Loader2,
  Lock,
  QrCode,
  ScanLine,
} from "lucide-react";
import { GlassPanel, KudoLogo, formatDate } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface VerifyValue {
  key: string;
  label: string;
  value: string;
}

interface VerifyResult {
  result: "verified" | "not_found" | "revoked" | "expired";
  certificate?: {
    certificateId: string;
    recipientName: string;
    templateName: string;
    category?: string | null;
    orgName: string;
    issueDate: string;
    issueDateFormatted: string;
    expiryDate?: string | null;
    revokedReason?: string | null;
    values: VerifyValue[];
    verifyCount: number;
  };
}

function StatusBadge({ result }: { result: VerifyResult["result"] }) {
  if (result === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success">
        <BadgeCheck className="size-4" /> VERIFIED
      </span>
    );
  }
  if (result === "revoked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-sm font-semibold text-destructive">
        <Ban className="size-4" /> CERTIFICATE REVOKED
      </span>
    );
  }
  if (result === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1 text-sm font-semibold text-warning">
        <AlertTriangle className="size-4" /> CERTIFICATE EXPIRED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
      <FileWarning className="size-4" /> NOT FOUND
    </span>
  );
}

export default function Verify() {
  const { certificateId: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const qrId = searchParams.get("id");
  const navigate = useNavigate();
  const [input, setInput] = useState(routeId ?? qrId ?? "");
  const [submitted, setSubmitted] = useState<string | null>(routeId ?? qrId ?? null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verify = useMutation(api.certificates.publicVerify);

  const runVerify = async (id: string) => {
    const clean = id.trim().toUpperCase();
    if (!clean) return;
    setSubmitted(clean);
    setLoading(true);
    setError(null);
    try {
      const r = await verify({ certificateId: clean });
      setResult(r);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Verification failed. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = routeId ?? qrId;
    if (initial) void runVerify(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, qrId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    navigate(`/verify/${encodeURIComponent(input.trim().toUpperCase())}`, { replace: true });
    void runVerify(input);
  };

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/">
            <KudoLogo />
          </Link>
          <Link
            to="/auth"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Admin sign in
          </Link>
        </div>

        <GlassPanel strong className="p-7">
          <div className="mb-6 flex items-start gap-4">
            <div className="glass-inset flex size-12 shrink-0 items-center justify-center rounded-2xl text-primary">
              <ScanLine className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Verify a certificate</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the certificate ID shown on the certificate, or scan its QR code —
                no account needed.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. KUDO-2026-000184"
              aria-label="Certificate ID"
              className="glass-input h-11 flex-1 font-mono uppercase"
              disabled={loading}
            />
            <Button type="submit" size="lg" className="h-11" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Verify certificate
            </Button>
          </form>

          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-4" /> {error}
            </p>
          )}
        </GlassPanel>

        {submitted && result && (
          <GlassPanel className="mt-5 p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <StatusBadge result={result.result} />
                <p className="mt-3 font-mono text-lg font-semibold tracking-tight">
                  {submitted}
                </p>
              </div>
              <div className="glass-inset rounded-xl p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {result.result === "verified" ? (
                    <>
                      <BadgeCheck className="size-4 text-success" />
                      Authenticity confirmed against the issuing records.
                    </>
                  ) : result.result === "not_found" ? (
                    <>
                      <FileWarning className="size-4 text-destructive" />
                      No certificate with this ID exists in our records.
                    </>
                  ) : result.result === "revoked" ? (
                    <>
                      <Ban className="size-4 text-destructive" />
                      The issuer revoked this certificate.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4 text-warning" />
                      This certificate passed its expiry date.
                    </>
                  )}
                </div>
              </div>
            </div>

            {result.result !== "not_found" && result.certificate && (
              <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">Issued to</dt>
                  <dd className="mt-0.5 font-semibold">{result.certificate.recipientName}</dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">Certificate</dt>
                  <dd className="mt-0.5 font-semibold">{result.certificate.templateName}</dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">Issued by</dt>
                  <dd className="mt-0.5 font-semibold">{result.certificate.orgName}</dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">Issued on</dt>
                  <dd className="mt-0.5 font-semibold">{formatDate(result.certificate.issueDate)}</dd>
                </div>
                {result.certificate.category && (
                  <div>
                    <dt className="text-xs tracking-wide text-muted-foreground uppercase">Category</dt>
                    <dd className="mt-0.5 font-semibold">{result.certificate.category}</dd>
                  </div>
                )}
                {result.certificate.revokedReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs tracking-wide text-destructive uppercase">Revocation reason</dt>
                    <dd className="mt-0.5 text-sm">{result.certificate.revokedReason}</dd>
                  </div>
                )}
              </dl>
            )}

            {result.result !== "not_found" && (result.certificate?.values?.length ?? 0) > 0 && (
              <div className="mt-6 border-t border-border/60 pt-4">
                <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Certificate details
                </p>
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {result.certificate!.values
                    .filter((v) => v.value)
                    .map((v) => (
                      <div key={v.key} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{v.label}</dt>
                        <dd className="text-right font-medium">{v.value}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}
          </GlassPanel>
        )}

        <GlassPanel className="mt-5 p-6">
          <div className="flex items-start gap-4">
            <div className="glass-inset flex size-10 shrink-0 items-center justify-center rounded-xl text-primary">
              <QrCode className="size-5" />
            </div>
            <div className="text-sm">
              <p className="font-medium">Scanning a QR code?</p>
              <p className="mt-1 text-muted-foreground">
                Every Kudo certificate can carry a QR code that opens its verification page
                directly. Scanning verifies the certificate against the issuer's live records —
                revoked or expired certificates are flagged instantly.
              </p>
            </div>
          </div>
        </GlassPanel>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Kudo verification pages are public. Admin data stays protected behind sign-in.
        </p>
      </div>
    </div>
  );
}
