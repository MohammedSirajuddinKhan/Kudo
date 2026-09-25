import { motion } from "framer-motion";
import { Link } from "react-router";
import { ArrowRight, QrCode } from "lucide-react";
import { GlassPanel, KudoLogo } from "@/components/glass";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen overflow-x-clip px-4">
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <div className="mb-8 flex justify-center">
            <Link to="/">
              <KudoLogo />
            </Link>
          </div>

          <GlassPanel strong className="p-10 text-center">
            <p className="text-gradient text-7xl font-bold tracking-tight sm:text-8xl">404</p>
            <h1 className="mt-4 text-xl font-bold tracking-tight">Page not found</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The page you're looking for doesn't exist or may have moved. If you were verifying
              a certificate, double-check the link or ID on the certificate itself.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/">
                  Back to home
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="glass border-border/40">
                <Link to="/verify">
                  <QrCode className="mr-1 size-4" />
                  Verify a certificate
                </Link>
              </Button>
            </div>
          </GlassPanel>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Create. Issue. Verify.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
