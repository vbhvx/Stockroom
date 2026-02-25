"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Boxes,
  ClipboardList,
  CreditCard,
  Truck,
  Users,
  ScrollText,
  LogOut,
  Building2,
  Store,
  Shield,
} from "lucide-react";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  currentStoreId?: string;
  stores: Array<{ id: string; name: string; currency: string }>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/v1/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Catalog", href: "/dashboard/catalog", icon: Boxes },
    { label: "Inventory", href: "/dashboard/inventory", icon: Layers },
    { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
    { label: "Payments & Refunds", href: "/dashboard/payments", icon: CreditCard },
    { label: "Fulfillment", href: "/dashboard/fulfillment", icon: Truck },
    { label: "Staff & RBAC", href: "/dashboard/staff", icon: Users },
    { label: "Audit Trail", href: "/dashboard/audit", icon: ScrollText },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <span className="text-sm font-medium">Loading Stockroom session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-white block">Stockroom</span>
            <span className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold block">
              Ops SaaS Core
            </span>
          </div>
        </div>

        {/* Tenant Scope Card */}
        <div className="p-3 mx-3 my-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate">{user?.organization.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Store className="h-3 w-3 text-slate-600" />
            <span>Store: {user?.stores?.[0]?.name || "Default Store"}</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-teal-400" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Staff Profile & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-teal-300">
                {user?.name.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                <div className="flex items-center gap-1 text-[10px]">
                  <Shield className="h-2.5 w-2.5 text-teal-400" />
                  <span className="capitalize text-teal-400 font-medium">{user?.role}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/40 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {pathname === "/dashboard" ? "Operations Executive Overview" : pathname.replace("/dashboard/", "").toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live System Normal</span>
            </div>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}

