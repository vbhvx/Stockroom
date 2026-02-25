"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Layers, KeyRound, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@stockroom.internal");
  const [password, setPassword] = useState("Password123!");
  const [organizationSlug, setOrganizationSlug] = useState("stockroom-global");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, organizationSlug }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Authentication failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickSwitch = (roleEmail: string, orgSlug = "stockroom-global") => {
    setEmail(roleEmail);
    setPassword("Password123!");
    setOrganizationSlug(orgSlug);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 mb-2 shadow-lg shadow-teal-500/10">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Stockroom Operations</h1>
          <p className="text-sm text-slate-400">
            Internal Operations SaaS & Inventory Control Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Staff Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                placeholder="staff@stockroom.internal"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                placeholder="••••••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organization Tenant Slug
              </label>
              <input
                type="text"
                value={organizationSlug}
                onChange={(e) => setOrganizationSlug(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                placeholder="stockroom-global"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-sm transition-all shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                "Signing In..."
              ) : (
                <>
                  <span>Enter Operations Console</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Role Switcher */}
          <div className="pt-4 border-t border-slate-800/80">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <KeyRound className="h-3 w-3 text-teal-400" />
              Quick Demo Personas
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => quickSwitch("owner@stockroom.internal")}
                className="px-2 py-1 text-xs rounded bg-slate-800/80 hover:bg-slate-700 text-teal-300 border border-slate-700/60"
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => quickSwitch("inventory@stockroom.internal")}
                className="px-2 py-1 text-xs rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              >
                Inventory Mgr
              </button>
              <button
                type="button"
                onClick={() => quickSwitch("order@stockroom.internal")}
                className="px-2 py-1 text-xs rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              >
                Order Mgr
              </button>
              <button
                type="button"
                onClick={() => quickSwitch("finance@stockroom.internal")}
                className="px-2 py-1 text-xs rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              >
                Finance
              </button>
              <button
                type="button"
                onClick={() => quickSwitch("fulfillment@stockroom.internal")}
                className="px-2 py-1 text-xs rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              >
                Fulfillment
              </button>
              <button
                type="button"
                onClick={() => quickSwitch("viewer@stockroom.internal")}
                className="px-2 py-1 text-xs rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              >
                Viewer
              </button>
              <button
                type="button"
                onClick={() => quickSwitch("admin@acme.internal", "acme-retail")}
                className="px-2 py-1 text-xs rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
              >
                Tenant B (Acme)
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Tenant Isolated &bull; RBAC Protected &bull; Traceable Ledger</span>
        </div>
      </div>
    </div>
  );
}

