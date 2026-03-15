import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  Stethoscope,
  FlaskConical,
  CheckCircle2,
  ArrowRight,
  LogIn,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

/* ------------------------------------------------------------------ */
/*  Intersection-Observer hook for scroll-triggered fade-in            */
/* ------------------------------------------------------------------ */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("landing-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`landing-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline SVG icons for the feature cards                             */
/* ------------------------------------------------------------------ */
function BarChartIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="6" y="28" width="8" height="14" rx="2" fill="#194CFF" />
      <rect x="20" y="18" width="8" height="24" rx="2" fill="#194CFF" opacity={0.7} />
      <rect x="34" y="8" width="8" height="34" rx="2" fill="#194CFF" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="#194CFF" />
      <rect x="6" y="22" width="12" height="12" rx="2" fill="#194CFF" opacity={0.5} />
      <rect x="22" y="6" width="12" height="12" rx="2" fill="#194CFF" opacity={0.5} />
      <rect x="22" y="22" width="12" height="12" rx="2" fill="#194CFF" opacity={0.3} />
      <rect x="38" y="6" width="4" height="12" rx="1" fill="#194CFF" opacity={0.3} />
      <rect x="38" y="22" width="4" height="12" rx="1" fill="#194CFF" opacity={0.2} />
    </svg>
  );
}

function LineGraphIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M6 36 L16 24 L26 30 L42 10"
        stroke="#194CFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="6" cy="36" r="3" fill="#194CFF" />
      <circle cx="16" cy="24" r="3" fill="#194CFF" opacity={0.7} />
      <circle cx="26" cy="30" r="3" fill="#194CFF" opacity={0.7} />
      <circle cx="42" cy="10" r="3" fill="#194CFF" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Persona SVG icons (inline, deep blue, ~80px)                       */
/* ------------------------------------------------------------------ */
function StudentIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Desk + laptop */}
      <rect x="8" y="32" width="32" height="2" rx="1" fill="#194CFF" opacity={0.3} />
      <rect x="14" y="20" width="20" height="12" rx="2" stroke="#194CFF" strokeWidth="2" fill="none" />
      <rect x="18" y="23" width="12" height="6" rx="1" fill="#194CFF" opacity={0.2} />
      {/* Person */}
      <circle cx="24" cy="12" r="4" stroke="#194CFF" strokeWidth="2" fill="none" />
      <path d="M16 18 Q24 16 32 18" stroke="#194CFF" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ResearcherIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Lab coat body */}
      <circle cx="24" cy="10" r="5" stroke="#194CFF" strokeWidth="2" fill="none" />
      <path d="M14 22 C14 17 20 15 24 15 C28 15 34 17 34 22 L34 36 L14 36 Z" stroke="#194CFF" strokeWidth="2" fill="none" />
      {/* Clipboard */}
      <rect x="20" y="24" width="8" height="10" rx="1" stroke="#194CFF" strokeWidth="1.5" fill="none" />
      <line x1="22" y1="27" x2="26" y2="27" stroke="#194CFF" strokeWidth="1" />
      <line x1="22" y1="30" x2="26" y2="30" stroke="#194CFF" strokeWidth="1" />
    </svg>
  );
}

function ClinicianIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Person */}
      <circle cx="24" cy="10" r="5" stroke="#194CFF" strokeWidth="2" fill="none" />
      <path d="M14 22 C14 17 20 15 24 15 C28 15 34 17 34 22 L34 38 L14 38 Z" stroke="#194CFF" strokeWidth="2" fill="none" />
      {/* Stethoscope */}
      <path d="M18 20 C18 26 22 28 24 28 C26 28 30 26 30 20" stroke="#194CFF" strokeWidth="1.5" fill="none" />
      <circle cx="24" cy="30" r="2" stroke="#194CFF" strokeWidth="1.5" fill="none" />
      {/* Cross */}
      <line x1="22" y1="34" x2="26" y2="34" stroke="#194CFF" strokeWidth="1.5" />
      <line x1="24" y1="32" x2="24" y2="36" stroke="#194CFF" strokeWidth="1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  /* Parallax on hero background */
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function handleScroll() {
      if (heroRef.current) {
        const offset = window.scrollY * 0.2;
        heroRef.current.style.backgroundPositionY = `${offset}px`;
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Chart animation via canvas */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartAnimated = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !chartAnimated.current) {
          chartAnimated.current = true;
          animateChart(canvas);
          observer.unobserve(canvas);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      className="min-h-screen bg-[#F9FAFB] text-[#0F172A]"
    >
      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section
        ref={heroRef}
        className="relative w-full min-h-[80vh] flex items-center justify-center"
        style={{
          background: "linear-gradient(180deg, #E0F2FE 0%, #FFFFFF 100%)",
        }}
      >
        <div className="max-w-[1200px] w-full mx-auto px-8 py-20 flex flex-col lg:flex-row items-center gap-16">
          {/* Text column */}
          <div className="flex-1 text-center lg:text-left">
            <h1
              className="text-[2rem] md:text-[2.5rem] lg:text-[3rem] font-extrabold leading-tight tracking-tight text-[#194CFF]"
              style={{ lineHeight: 1.15 }}
            >
              Nuphorm: AI-Powered Biostatistics for Research Excellence
            </h1>
            <p
              className="mt-6 text-[#0F172A] text-base md:text-lg lg:text-xl max-w-[640px]"
              style={{ lineHeight: 1.7 }}
            >
              Streamline your research with automated data cleaning, charting,
              and analysis — built for university students, researchers, and
              clinicians.
            </p>
            <div className="flex items-center gap-4 mt-8 flex-wrap">
              <Link
                href="/demo-create"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#194CFF] text-white font-semibold text-base
                           shadow-md hover:bg-[#3B82F6] hover:scale-[1.05] hover:shadow-lg
                           transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#194CFF]/50"
                aria-label="Try Demo"
              >
                Try Demo <ArrowRight className="w-5 h-5" />
              </Link>
              {isAuthenticated ? (
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-[#194CFF] text-[#194CFF] font-semibold text-base
                             hover:bg-[#194CFF]/5 hover:scale-[1.05]
                             transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#194CFF]/50"
                >
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => setLocation("/login")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-[#2b7de9] text-[#2b7de9] font-semibold text-base
                             hover:bg-[#2b7de9]/5 hover:scale-[1.05]
                             transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2b7de9]/50"
                >
                  <LogIn className="w-5 h-5" /> Sign In
                </button>
              )}
            </div>
            {!isAuthenticated && (
              <p className="mt-4 text-sm text-[#5a7a96]">
                New to Nuphorm?{" "}
                <Link href="/signup" className="text-[#2b7de9] font-semibold hover:underline">
                  Create an account
                </Link>
              </p>
            )}
          </div>

          {/* Illustration column */}
          <div
            className="flex-1 max-w-[520px] w-full"
            role="img"
            aria-label="Illustration of AI generating biostatistics charts, graphs, and tables from raw data on a laptop screen."
          >
            <div
              className="relative bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-6 overflow-hidden"
              style={{ animation: "heroFadeIn 1s ease-out both" }}
            >
              {/* Mock laptop screen */}
              <div className="bg-[#F1F5F9] rounded-lg p-4 space-y-4">
                {/* Pipeline label */}
                <div className="flex items-center gap-2 text-xs text-[#64748b]">
                  <Sparkles className="w-4 h-4 text-[#194CFF]" />
                  <span className="font-medium">Raw Data</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-medium text-[#194CFF]">AI Processing</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-medium text-[#22C55E]">Results</span>
                </div>
                {/* Mock bars */}
                <div className="flex items-end gap-2 h-32">
                  {[60, 85, 45, 95, 70, 50, 80].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md"
                      style={{
                        height: `${h}%`,
                        background:
                          i % 3 === 0
                            ? "#194CFF"
                            : i % 3 === 1
                            ? "#EC4899"
                            : "#22C55E",
                        opacity: 0.85,
                        animation: `barGrow 0.6s ease-out ${i * 0.08}s both`,
                      }}
                    />
                  ))}
                </div>
                {/* Mock table rows */}
                <div className="space-y-1.5">
                  {[1, 2, 3].map((r) => (
                    <div key={r} className="flex gap-2">
                      <div className="h-3 rounded bg-[#D1D5DB] flex-[2]" />
                      <div className="h-3 rounded bg-[#D1D5DB] flex-1" />
                      <div className="h-3 rounded bg-[#22C55E]/40 flex-1" />
                    </div>
                  ))}
                </div>
              </div>
              {/* Floating checkmarks */}
              <div className="absolute top-3 right-3 flex gap-1">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" style={{ animation: "popIn 0.4s ease-out 0.8s both" }} />
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" style={{ animation: "popIn 0.4s ease-out 1s both" }} />
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" style={{ animation: "popIn 0.4s ease-out 1.2s both" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  WHAT WE DO                                                  */}
      {/* ============================================================ */}
      <section
        className="bg-white"
        style={{ borderTop: "1px solid #D1D5DB" }}
        aria-labelledby="what-we-do"
      >
        <div className="max-w-[1200px] mx-auto px-8 py-24">
          <RevealSection>
            <h2
              id="what-we-do"
              className="text-center text-[2rem] md:text-[2.5rem] font-bold text-[#194CFF] mb-16"
            >
              What Nuphorm Offers
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                Icon: BarChartIcon,
                title: "Automated Data Cleaning",
                desc: "Upload your research data (CSV, Excel) and let AI handle formatting, outlier detection, and preparation — saving hours on grunt work for your projects, just like avoiding delays that cost researchers valuable time.",
              },
              {
                Icon: TableIcon,
                title: "Instant Charts & Tables",
                desc: "Generate publication-ready visuals like histograms, scatter plots, and summary tables with one click, traceable to source data.",
              },
              {
                Icon: LineGraphIcon,
                title: "Basic Statistical Analysis",
                desc: "Run routine stats like means, regressions, and p-values with 100% auditability, reducing manual errors that plague research.",
              },
            ].map(({ Icon, title, desc }, i) => (
              <RevealSection key={title}>
                <article
                  className="bg-white rounded-2xl p-8 min-h-[300px] flex flex-col
                             border border-[#E2E8F0] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]
                             hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <Icon />
                  <h3 className="mt-6 text-xl font-bold text-[#0F172A]">{title}</h3>
                  <p className="mt-3 text-[#0F172A] leading-relaxed flex-1">{desc}</p>
                </article>
              </RevealSection>
            ))}
          </div>

          <RevealSection className="mt-16 text-center">
            <Link
              href="/demo-create"
              className="inline-flex items-center gap-2 text-[#194CFF] font-semibold text-lg
                         hover:underline hover:gap-3 transition-all duration-200"
            >
              See it in action <ArrowRight className="w-5 h-5" />
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  WHO WE SERVE                                                */}
      {/* ============================================================ */}
      <section
        className="relative"
        style={{
          background: "linear-gradient(180deg, #E0F2FE 0%, #FFFFFF 100%)",
        }}
        aria-labelledby="who-we-serve"
      >
        <div className="max-w-[1200px] mx-auto px-8 py-24">
          <RevealSection>
            <h2
              id="who-we-serve"
              className="text-center text-[2rem] md:text-[2.5rem] font-bold text-[#194CFF] mb-6"
            >
              Designed for Researchers
            </h2>
            <p className="text-center text-[#0F172A] text-base md:text-lg max-w-[800px] mx-auto leading-relaxed mb-12">
              Nuphorm is in its initial phase, tailored for anyone conducting
              research that requires biostatistics. Whether you're analyzing
              clinical data for a project or cleaning datasets for insights, we
              remove the tedium so you can focus on breakthroughs — mirroring
              how documentation bottlenecks delay research timelines, but
              optimized for your needs.
            </p>
          </RevealSection>

          <div className="flex flex-col lg:flex-row gap-16 items-start">
            {/* Checklist */}
            <RevealSection className="flex-1">
              <ul className="space-y-5">
                {[
                  "Students in biostats programs tackling routine analyses",
                  "Researchers handling pharma-inspired datasets with traceable outputs",
                  "Clinicians needing quick, compliant tools to avoid rework",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#22C55E] flex-shrink-0 mt-0.5" />
                    <span className="text-[#0F172A] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </RevealSection>

            {/* Persona icons */}
            <RevealSection className="flex-1">
              <div className="flex justify-center lg:justify-start gap-16">
                {[
                  { SvgIcon: StudentIcon, LucideIcon: GraduationCap, label: "Students" },
                  { SvgIcon: ResearcherIcon, LucideIcon: FlaskConical, label: "Researchers" },
                  { SvgIcon: ClinicianIcon, LucideIcon: Stethoscope, label: "Clinicians" },
                ].map(({ SvgIcon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-3 group"
                  >
                    <div
                      className="w-20 h-20 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm
                                  flex items-center justify-center
                                  group-hover:scale-110 group-hover:shadow-md transition-all duration-300"
                    >
                      <SvgIcon />
                    </div>
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  KEY STATS                                                   */}
      {/* ============================================================ */}
      <section className="bg-white" aria-labelledby="key-stats">
        <div className="max-w-[1200px] mx-auto px-8 py-24">
          <RevealSection>
            <h2
              id="key-stats"
              className="text-center text-[2rem] md:text-[2.5rem] font-bold text-[#194CFF] mb-16"
            >
              Why Choose Nuphorm for Your Research
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                stat: "~50%",
                label: "Workload Reduction",
                desc: "AI automates repetitive tasks, cutting grunt work like data cleaning by 19-50% compared to manual methods.",
              },
              {
                stat: "21-54%",
                label: "Faster Processing",
                desc: "Deliver insights in real-time, speeding up analysis vs. time-consuming Excel/manual workflows.",
              },
              {
                stat: "AI",
                label: "Reduced Errors",
                desc: "Minimize human bias and errors, ensuring higher accuracy and consistency in biostats outputs.",
              },
              {
                stat: "85%",
                label: "Efficiency Boost",
                desc: "Users report significant productivity gains, freeing time for strategic research over manual tedium.",
              },
            ].map(({ stat, label, desc }, i) => (
              <RevealSection key={label}>
                <div
                  className="border border-[#D1D5DB] rounded-xl p-6 text-center
                             hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="text-[2.5rem] font-extrabold text-[#22C55E] leading-none">
                    {stat}
                  </div>
                  <div className="mt-2 text-lg font-bold text-[#0F172A]">
                    {label}
                  </div>
                  <p className="mt-3 text-sm text-[#0F172A] leading-relaxed">
                    {desc}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>

          {/* Productivity Comparison chart */}
          <RevealSection className="mt-20 flex justify-center">
            <div className="w-full max-w-[640px]">
              <h3 className="text-center text-lg font-bold text-[#0F172A] mb-6">
                Productivity Comparison
              </h3>
              <canvas
                ref={canvasRef}
                width={640}
                height={340}
                className="w-full h-auto"
                aria-label="Bar chart comparing Manual vs Nuphorm AI across Time to Insights, Error Rate, Workload, and Efficiency"
                role="img"
              />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER / CTA                                                */}
      {/* ============================================================ */}
      <footer className="bg-[#0F172A]" aria-label="Footer">
        <div className="max-w-[1200px] mx-auto px-8 py-16 text-center">
          <RevealSection>
            <p className="text-white text-2xl md:text-3xl font-bold mb-8">
              Ready to accelerate your research?
            </p>
            <Link
              href="/demo-create"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#194CFF] text-white font-semibold text-base
                         shadow-md hover:bg-[#3B82F6] hover:scale-[1.05] hover:shadow-lg
                         transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Try Demo"
            >
              Try Demo <ArrowRight className="w-5 h-5" />
            </Link>
          </RevealSection>

          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-[#9CA3AF]">
            <a href="#" className="hover:text-white transition-colors duration-200">
              About Us
            </a>
            <a href="#" className="hover:text-white transition-colors duration-200">
              Contact
            </a>
            <a href="#" className="hover:text-white transition-colors duration-200">
              Privacy
            </a>
          </div>

          <p className="mt-8 text-sm text-[#9CA3AF]">
            &copy; 2026 Nuphorm &mdash; AI-Native Tools for Research
            Biostatistics.
          </p>
        </div>
      </footer>

      {/* ============================================================ */}
      {/*  Inline styles for animations                                */}
      {/* ============================================================ */}
      <style>{`
        .landing-hidden {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .landing-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); transform-origin: bottom; }
          to   { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas chart: 4-metric comparison (Manual vs Nuphorm AI)           */
/* ------------------------------------------------------------------ */
function animateChart(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;

  const metrics = [
    { label: "Time to Insights", manual: 100, ai: 33 },
    { label: "Error Rate", manual: 80, ai: 20 },
    { label: "Workload", manual: 90, ai: 50 },
    { label: "Efficiency", manual: 50, ai: 85 },
  ];

  const topPad = 12;
  const bottomPad = 56;
  const leftPad = 16;
  const rightPad = 16;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const groupGap = 20;
  const barGap = 4;
  const groupW = (chartW - groupGap * (metrics.length - 1)) / metrics.length;
  const barW = (groupW - barGap) / 2;
  const maxVal = 100;

  const manualColor = "#EC4899";
  const aiColor = "#3B82F6";

  const duration = 900;
  const startTime = performance.now();

  function draw(now: number) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    ctx!.clearRect(0, 0, W, H);

    // Draw bars
    metrics.forEach((m, i) => {
      const groupX = leftPad + i * (groupW + groupGap);

      // Manual bar
      const mH = (m.manual / maxVal) * chartH * ease;
      const mX = groupX;
      const mY = topPad + chartH - mH;
      ctx!.beginPath();
      ctx!.roundRect(mX, mY, barW, mH, [6, 6, 0, 0]);
      ctx!.fillStyle = manualColor;
      ctx!.fill();

      // AI bar
      const aH = (m.ai / maxVal) * chartH * ease;
      const aX = groupX + barW + barGap;
      const aY = topPad + chartH - aH;
      ctx!.beginPath();
      ctx!.roundRect(aX, aY, barW, aH, [6, 6, 0, 0]);
      ctx!.fillStyle = aiColor;
      ctx!.fill();

      // Value labels on bars
      if (t > 0.5) {
        const labelAlpha = Math.min((t - 0.5) * 2, 1);
        ctx!.globalAlpha = labelAlpha;
        ctx!.font = "600 11px Inter, system-ui, sans-serif";
        ctx!.textAlign = "center";

        ctx!.fillStyle = "#FFFFFF";
        if (mH > 22) ctx!.fillText(`${m.manual}`, mX + barW / 2, mY + 16);
        if (aH > 22) ctx!.fillText(`${m.ai}`, aX + barW / 2, aY + 16);

        ctx!.globalAlpha = 1;
      }

      // Metric label below
      ctx!.fillStyle = "#0F172A";
      ctx!.font = "500 11px Inter, system-ui, sans-serif";
      ctx!.textAlign = "center";
      const labelX = groupX + groupW / 2;
      const labelY = topPad + chartH + 18;

      // Wrap label if needed
      const words = m.label.split(" ");
      if (words.length <= 2) {
        ctx!.fillText(m.label, labelX, labelY);
      } else {
        const mid = Math.ceil(words.length / 2);
        ctx!.fillText(words.slice(0, mid).join(" "), labelX, labelY);
        ctx!.fillText(words.slice(mid).join(" "), labelX, labelY + 14);
      }
    });

    // Legend
    ctx!.font = "500 12px Inter, system-ui, sans-serif";
    ctx!.textAlign = "left";
    const legendY = topPad + chartH + 44;

    const legendX = W / 2 - 100;
    ctx!.fillStyle = manualColor;
    ctx!.beginPath();
    ctx!.roundRect(legendX, legendY - 8, 12, 12, 3);
    ctx!.fill();
    ctx!.fillStyle = "#0F172A";
    ctx!.fillText("Manual", legendX + 18, legendY + 2);

    ctx!.fillStyle = aiColor;
    ctx!.beginPath();
    ctx!.roundRect(legendX + 100, legendY - 8, 12, 12, 3);
    ctx!.fill();
    ctx!.fillStyle = "#0F172A";
    ctx!.fillText("Nuphorm AI", legendX + 118, legendY + 2);

    if (t < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
