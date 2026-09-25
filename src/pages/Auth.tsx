import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { GlassPanel, KudoLogo, ThemeToggle } from "@/components/glass";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect, { replace: true });
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect, { replace: true });
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/">
            <KudoLogo />
          </Link>
          <ThemeToggle />
        </div>

        <GlassPanel strong className="p-7">
          {step === "signIn" ? (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold tracking-tight">Sign in to Kudo</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Administrators sign in with email — we'll send a one-time code.
                </p>
              </div>
              <form onSubmit={handleEmailSubmit}>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    placeholder="admin@yourdomain.com"
                    type="email"
                    className="glass-input pl-9"
                    disabled={isLoading}
                    required
                    autoComplete="email"
                  />
                </div>
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
                <Button type="submit" className="mt-5 w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      Continue with email
                      <ArrowRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              </form>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="glass w-full border-border/40"
                onClick={handleGuestLogin}
                disabled={isLoading}
              >
                Continue as guest (demo mode)
              </Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Guest mode is for evaluation only. Sign in with email for a real account.
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-xl font-bold tracking-tight">Check your email</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We've sent a 6-digit code to <span className="font-medium text-foreground">{step.email}</span>
                </p>
              </div>
              <form onSubmit={handleOtpSubmit}>
                <input type="hidden" name="email" value={step.email} />
                <input type="hidden" name="code" value={otp} />
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                        (e.target as HTMLElement).closest("form")?.requestSubmit();
                      }
                    }}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error && (
                  <p className="mt-3 text-center text-sm text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  className="mt-5 w-full"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify code
                      <ArrowRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("signIn")}
                  disabled={isLoading}
                  className="mt-2 w-full"
                >
                  Use a different email
                </Button>
              </form>
            </>
          )}
        </GlassPanel>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Secured session · passwords are never stored in the app
        </p>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
