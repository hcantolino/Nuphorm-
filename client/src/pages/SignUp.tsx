import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import TechBackground from "@/components/TechBackground";

/* ── Brand logos ── */
function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/regulatory");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleGoogleSignUp = () => {
    // TODO: Implement Google OAuth
    console.log("Google Sign-Up clicked");
    setLocation("/regulatory");
  };

  const handleMicrosoftSignUp = () => {
    // TODO: Implement Microsoft OAuth
    console.log("Microsoft Sign-Up clicked");
    setLocation("/regulatory");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Implement email sign-up via API
      console.log("Sign up with:", { fullName, email, password });
      setLocation("/regulatory");
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#eaf2fa" }}>
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative py-12" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <TechBackground />

      {/* NuPhorm logo above card */}
      <div className="relative z-10 flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-[#194CFF] flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <span className="text-[#1a2332] font-bold text-xl">NuPhorm</span>
      </div>

      {/* Sign up card */}
      <div
        className="relative z-10 w-full max-w-[420px] bg-white rounded-2xl"
        style={{ padding: "40px 44px 36px", boxShadow: "0 20px 60px rgba(0,0,0,0.1)" }}
      >
        <h1 className="text-2xl font-bold text-[#1a2332] text-center mb-1">Create Account</h1>
        <p className="text-[13.5px] text-[#7a8fa3] text-center mb-8" style={{ fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
          Start building your analyses
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* OAuth buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleSignUp}
            className="w-full h-11 flex items-center justify-center gap-3 rounded-lg bg-[#1a2332] text-white text-sm font-medium hover:bg-[#2a3a4f] transition-colors"
          >
            <GoogleLogo />
            Sign up with Google
          </button>
          <button
            onClick={handleMicrosoftSignUp}
            className="w-full h-11 flex items-center justify-center gap-3 rounded-lg bg-[#1a2332] text-white text-sm font-medium hover:bg-[#2a3a4f] transition-colors"
          >
            <MicrosoftLogo />
            Sign up with Microsoft
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-[#7a8fa3]">Or sign up with email</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2332]/20 focus:border-[#1a2332] transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2332]/20 focus:border-[#1a2332] transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2332]/20 focus:border-[#1a2332] transition-all"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2332]/20 focus:border-[#1a2332] transition-all"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-[#1a2332] text-white text-sm font-medium hover:bg-[#2a3a4f] transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* Switch to login */}
        <p className="text-center text-sm text-[#7a8fa3] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1a2332] font-semibold hover:underline">
            Sign in
          </Link>
        </p>

        {/* Terms */}
        <p className="text-center text-xs text-[#9ab0c4] mt-5">
          By signing up you agree to our{" "}
          <a href="#" className="text-[#7a8fa3] underline">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-[#7a8fa3] underline">Privacy Policy</a>
        </p>
      </div>

      {/* Demo + Back links */}
      <p className="relative z-10 mt-6 text-sm text-[#7a8fa3]">
        Just want to explore?{" "}
        <Link href="/demo-create" className="text-[#2b7de9] font-medium hover:underline">
          Try the demo &rarr;
        </Link>
      </p>
      <Link href="/" className="relative z-10 mt-3 text-sm text-[#7a8fa3] hover:text-[#1a2332] transition-colors">
        &larr; Back to home
      </Link>
    </div>
  );
}
