import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  Sparkles,
  Upload,
  ScanSearch,
  SlidersHorizontal,
  Layers,
  BadgeCheck,
  FileDown,
  QrCode,
  History,
  ScrollText,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  LayoutTemplate,
  Users,
  Boxes,
} from "lucide-react";
import { GlassPanel, KudoLogo, ThemeToggle } from "@/components/glass";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    text: "Start from any certificate design — JPG, PNG or PDF. Your original file is preserved untouched.",
  },
  {
    icon: ScanSearch,
    title: "Analyze",
    text: "AI identifies the editable regions and suggests meaningful field names and types.",
  },
  {
    icon: SlidersHorizontal,
    title: "Customize",
    text: "Fine-tune every field: position, typography, alignment and fitting. Add your own anywhere.",
  },
  {
    icon: Layers,
    title: "Generate",
    text: "Issue one polished certificate or hundreds at once from a spreadsheet, with unique IDs.",
  },
  {
    icon: BadgeCheck,
    title: "Verify",
    text: "Every certificate carries a verification QR that anyone can scan — no account needed.",
  },
];

const features = [
  { icon: Sparkles, title: "AI-powered template analysis", text: "Detects blank spaces, underlines and boxes in any design." },
  { icon: LayoutTemplate, title: "Visual template editor", text: "Drag, resize and restyle fields on top of your original." },
  { icon: Users, title: "Single or bulk generation", text: "One recipient or thousands — import XLSX, CSV or paste rows." },
  { icon: FileDown, title: "PDF & PNG export", text: "Print-ready, high-resolution output for every certificate." },
  { icon: QrCode, title: "QR verification", text: "Public verification pages with unique certificate IDs." },
  { icon: History, title: "Certificate history", text: "Search, filter, revoke and reissue from one dashboard." },
  { icon: ScrollText, title: "Audit logs", text: "A complete, append-only trail of every important action." },
  { icon: BarChart3, title: "Reports", text: "Issuance trends, template breakdowns and verification stats." },
  { icon: ShieldCheck, title: "Secure administration", text: "Protected routes, server-side validation and safe file handling." },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Header */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <GlassPanel strong className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <KudoLogo />
            <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Primary">
              <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
              <a href="#features" className="transition-colors hover:text-foreground">Features</a>
              <Link to="/verify" className="transition-colors hover:text-foreground">Verify</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Create certificates</Link>
            </Button>
          </div>
        </GlassPanel>
      </header>

      {/* Hero */}
      <section className="relative px-4 pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="glass-inset mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Digital certificate creator & verification platform
            </span>
            <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight text-balance sm:text-6xl">
              <span className="text-gradient">Create. Issue. Verify.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Create professional digital certificates from any template, generate them
              individually or in bulk, and let anyone verify their authenticity instantly.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-7 text-base">
                <Link to="/auth">
                  Create certificates
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="glass h-12 border-border/40 px-7 text-base">
                <Link to="/verify">
                  <QrCode className="mr-1 size-4" />
                  Verify a certificate
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Mock certificate panel */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative mx-auto mt-14 max-w-4xl"
          >
            <div className="glass-editor absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/12 via-transparent to-chart-2/12 blur-2xl" aria-hidden="true" />
            <GlassPanel className="overflow-hidden p-3 sm:p-4">
              <div className="editor-canvas relative overflow-hidden rounded-xl bg-white">
                <div className="aspect-[1.414/1] w-full p-6 sm:p-10">
                  <div className="flex h-full flex-col items-center justify-between text-center">
                    <div className="space-y-2">
                      <div className="mx-auto h-2 w-40 rounded-full bg-foreground/10" />
                      <div className="mx-auto h-7 w-64 rounded-lg bg-foreground/10 sm:w-96" />
                      <div className="mx-auto h-2 w-72 rounded-full bg-foreground/10 sm:w-[26rem]" />
                    </div>
                    <div className="w-full space-y-4">
                      <div className="mx-auto flex w-full max-w-md items-center justify-center border-b-2 border-dashed border-primary/40 pb-1">
                        <span className="text-sm font-medium text-primary/80">Recipient Name</span>
                      </div>
                      <div className="mx-auto h-2 w-52 rounded-full bg-foreground/10" />
                      <div className="flex items-end justify-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="h-px w-28 bg-foreground/20" />
                          <span className="text-[10px] text-muted-foreground">Date</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="h-px w-32 bg-foreground/20" />
                          <span className="text-[10px] text-muted-foreground">Signature</span>
                        </div>
                        <div className="grid size-14 place-items-center rounded bg-foreground/5">
                          <QrCode className="size-7 text-primary/70" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <BadgeCheck className="size-3.5 text-chart-2" />
                      KUDO-2026-000184 · Verified
                    </div>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How Kudo works</h2>
            <p className="mt-3 text-muted-foreground">
              From any certificate design to verifiable credentials in five steps.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
              >
                <GlassPanel hover className="h-full p-5">
                  <div className="glass-inset mb-4 flex size-10 items-center justify-center rounded-xl text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <p className="text-xs font-semibold tracking-widest text-primary/80 uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything an institution needs
            </h2>
            <p className="mt-3 text-muted-foreground">
              Serious tooling for issuing official certificates — not a toy.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
              >
                <GlassPanel hover className="flex h-full gap-4 p-5">
                  <div className="glass-inset flex size-10 shrink-0 items-center justify-center rounded-xl text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <GlassPanel strong className="relative overflow-hidden p-10 text-center sm:p-14">
            <div className="glass-editor absolute -top-24 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
            <Boxes className="mx-auto mb-4 size-10 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to issue your first certificate?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Sign in to upload a template, let AI map the fields, and start generating
              in minutes. Recipients never need an account.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-7">
                <Link to="/auth">Create certificates</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="glass border-border/40 px-7">
                <Link to="/verify">Verify a certificate</Link>
              </Button>
            </div>
          </GlassPanel>
        </div>
      </section>

      <footer className="px-4 pb-10">
        <GlassPanel className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-5 text-sm text-muted-foreground sm:flex-row">
          <KudoLogo size={26} />
          <p>Create. Issue. Verify.</p>
          <div className="flex items-center gap-4">
            <Link to="/verify" className="transition-colors hover:text-foreground">Verify</Link>
            <Link to="/auth" className="transition-colors hover:text-foreground">Sign in</Link>
          </div>
        </GlassPanel>
      </footer>
    </div>
  );
}
