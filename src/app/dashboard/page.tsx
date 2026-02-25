"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  AlertTriangle,
  CreditCard,
  Truck,
  ArrowRight,
  TrendingUp,
  History,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";

interface OperationalSummary {
  orders: {
    awaitingAction: number;
    processing: number;
    fulfilled: number;
  };
  inventory: {
    lowStockCount: number;
    lowStockItems: Array<{
      id: string;
      sku: string;
      productName: string;
      available: number;
      onHand: number;
      reserved: number;
    }>;
  };
  payments: {
    pending: number;
    failed: number;
  };
  fulfillment: {
    openExceptions: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    actorId: string;
    resourceType: string;
    resourceId: string;
    reason: string;
    createdAt: string;
  }>;
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OperationalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/v1/reports/operations");
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load operations summary:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-white">Operations Command Center</h1>
        <p className="text-xs text-slate-400">
          Live operational status, stock alerts, payment reconciliation, and fulfillment pipelines.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Orders Awaiting Action */}
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Orders Requiring Action</span>
            <ClipboardList className="h-4 w-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {data?.orders.awaitingAction ?? 0}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-teal-400">
            <span>Pending & Confirmed</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Low Stock Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {data?.inventory.lowStockCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            Available stock &le; 5 units
          </div>
        </div>

        {/* Payment Exceptions / Pending */}
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Payment Pipeline</span>
            <CreditCard className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {data?.payments.pending ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            Pending settlements ({data?.payments.failed ?? 0} failed)
          </div>
        </div>

        {/* Fulfillment Exceptions */}
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Fulfillment Exceptions</span>
            <Truck className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300">
            {data?.fulfillment.openExceptions ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            Active warehouse/carrier issues
          </div>
        </div>
      </div>

      {/* Main Grid: Low Stock Alert List & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Breakdown */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Stock Availability & Critical Levels
            </h2>
            <Link
              href="/dashboard/inventory"
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
            >
              <span>Manage Inventory</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data?.inventory.lowStockItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
              All stocked items have healthy available inventory reserves.
            </div>
          ) : (
            <div className="space-y-2">
              {data?.inventory.lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs"
                >
                  <div>
                    <p className="font-medium text-slate-200">{item.productName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      {item.available} Available
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      On-Hand: {item.onHand} | Reserved: {item.reserved}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Operational Audit Feed */}
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-teal-400" />
              Recent Traceable Staff Activity
            </h2>
            <Link
              href="/dashboard/audit"
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
            >
              <span>View Full Trail</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data?.recentActivity?.map((act) => (
              <div
                key={act.id}
                className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-teal-300 font-mono text-[11px]">
                    {act.action}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(act.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] truncate">{act.reason || "Action performed"}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Actor: {act.actorId}</span>
                  <span>Ref: {act.resourceId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

