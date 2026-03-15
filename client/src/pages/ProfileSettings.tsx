import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Lock,
  Download,
  Trash2,
  Moon,
  Bell,
  FileText,
  BarChart3,
  Save,
  Database,
} from "lucide-react";

/* ── Mock storage data (replace with real Supabase queries) ── */
const STORAGE_CATEGORIES = [
  { label: "Regulatory Documents", icon: FileText, usedMB: 45.2, color: "#2b7de9" },
  { label: "Biostatistics Analyses", icon: BarChart3, usedMB: 12.8, color: "#1a5fb4" },
  { label: "Technical Files", icon: Save, usedMB: 89.4, color: "#3b82f6" },
  { label: "Uploaded Data", icon: Database, usedMB: 234.1, color: "#60a5fa" },
];
const TOTAL_GB = 5.0;
const totalUsedMB = STORAGE_CATEGORIES.reduce((s, c) => s + c.usedMB, 0);
const totalUsedGB = totalUsedMB / 1024;
const usedPercent = (totalUsedGB / TOTAL_GB) * 100;

/* ── Toggle component ── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[#2b7de9]" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ProfileSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  /* Form state */
  const [fullName, setFullName] = useState(user?.name || "");
  const [organization, setOrganization] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  /* Preferences */
  const [nightMode, setNightMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [docFormat, setDocFormat] = useState("fda-ectd");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to view your profile.</p>
          <button
            onClick={() => setLocation("/login")}
            className="px-6 py-2 rounded-lg bg-[#2b7de9] text-white text-sm font-medium hover:bg-[#1a5fb4] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const userInitial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U";
  const maxBarMB = Math.max(...STORAGE_CATEGORIES.map((c) => c.usedMB));

  return (
    <div
      className="min-h-screen bg-[#f8fafc] py-8 px-6"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Section A: Profile Header ── */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2b7de9] to-[#1a5fb4] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-2xl">{userInitial}</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1a2332]">{user.name || "User"}</h1>
            <p className="text-sm text-[#5a7a96]">{user.email}</p>
            <button className="text-xs text-[#2b7de9] hover:underline mt-1">Edit Avatar</button>
          </div>
        </div>

        {/* ── Section B: Personal Information ── */}
        <div className="bg-white rounded-xl border border-[#dce6f0] p-6">
          <h2 className="text-base font-semibold text-[#1a2332] mb-5">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7de9]/20 focus:border-[#2b7de9] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Email</label>
              <input
                type="email"
                value={user.email || ""}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-[#f7fafc] text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Organization</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Your company or institution"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7de9]/20 focus:border-[#2b7de9] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Role / Title</label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Researcher, Biostatistician"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7de9]/20 focus:border-[#2b7de9] transition-all"
              />
            </div>
          </div>
          <div className="mt-5">
            <button className="px-5 py-2 rounded-lg bg-[#2b7de9] text-white text-sm font-medium hover:bg-[#1a5fb4] transition-colors">
              Save Changes
            </button>
          </div>
        </div>

        {/* ── Section C: Storage Usage ── */}
        <div className="bg-white rounded-xl border border-[#dce6f0] p-6">
          <h2 className="text-base font-semibold text-[#1a2332] mb-5">Storage Used</h2>

          {/* Main bar */}
          <div className="w-full h-3 rounded-full bg-[#e2e8f0] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(usedPercent, 100)}%`,
                background: "linear-gradient(90deg, #2b7de9, #1a5fb4)",
              }}
            />
          </div>
          <p className="text-sm text-[#5a7a96] mt-2">
            {totalUsedGB.toFixed(1)} GB of {TOTAL_GB.toFixed(1)} GB used
          </p>

          {/* Category breakdown */}
          <div className="mt-5 space-y-3">
            {STORAGE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const pct = maxBarMB > 0 ? (cat.usedMB / maxBarMB) * 100 : 0;
              return (
                <div key={cat.label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[#5a7a96] flex-shrink-0" />
                  <span className="text-sm text-[#1a2332] w-48 flex-shrink-0">{cat.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-[#e2e8f0] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                  <span className="text-xs text-[#5a7a96] w-16 text-right flex-shrink-0">
                    {cat.usedMB.toFixed(1)} MB
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section D: Account Actions ── */}
        <div className="bg-white rounded-xl border border-[#dce6f0] p-6">
          <h2 className="text-base font-semibold text-[#1a2332] mb-5">Account</h2>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1a2332] text-[#1a2332] text-sm font-medium hover:bg-gray-50 transition-colors">
              <Lock className="w-4 h-4" />
              Change Password
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1a2332] text-[#1a2332] text-sm font-medium hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export My Data
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e53e3e] text-[#e53e3e] text-sm font-medium hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
          <p className="text-xs text-[#9ab0c4] mt-2">Deleting your account is permanent and cannot be undone.</p>
        </div>

        {/* ── Section E: Preferences ── */}
        <div className="bg-white rounded-xl border border-[#dce6f0] p-6">
          <h2 className="text-base font-semibold text-[#1a2332] mb-5">Preferences</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1a2332] flex items-center gap-2">
                  <Moon className="w-4 h-4" /> Night Mode
                </p>
                <p className="text-xs text-[#5a7a96] mt-0.5">Switch to a dark color scheme</p>
              </div>
              <Toggle checked={nightMode} onChange={setNightMode} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1a2332] flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Email Notifications
                </p>
                <p className="text-xs text-[#5a7a96] mt-0.5">Receive updates about your analyses</p>
              </div>
              <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a2332] mb-1.5">Default Document Format</label>
              <select
                value={docFormat}
                onChange={(e) => setDocFormat(e.target.value)}
                className="w-full max-w-xs px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7de9]/20 focus:border-[#2b7de9] transition-all bg-white"
              >
                <option value="fda-ectd">FDA eCTD</option>
                <option value="ema">EMA</option>
                <option value="ich">ICH</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
