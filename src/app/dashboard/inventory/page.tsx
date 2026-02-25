"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Plus,
  SlidersHorizontal,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  History,
  FileCheck2,
} from "lucide-react";

interface Balance {
  id: string;
  locationId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  sku: string;
  locationName: string;
  locationCode: string;
  updatedAt: string;
}

interface Movement {
  id: string;
  movementType: string;
  quantityDelta: number;
  referenceType: string;
  referenceId: string;
  reason: string;
  actorId: string;
  sku: string;
  locationCode: string;
  createdAt: string;
}

interface ReconciliationReport {
  locationId: string;
  variantId: string;
  storedOnHand: number;
  storedReserved: number;
  calculatedOnHand: number;
  calculatedReserved: number;
  discrepancyDetected: boolean;
  differenceOnHand: number;
  differenceReserved: number;
}

export default function InventoryPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"balances" | "movements" | "reconciliation">("balances");

  // Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("loc_nj_warehouse");

  // Form states
  const [receiptQty, setReceiptQty] = useState(25);
  const [receiptReason, setReceiptReason] = useState("Standard supplier purchase order receipt");

  const [adjustmentDelta, setAdjustmentDelta] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");

  // Reconciliation state
  const [reconReport, setReconReport] = useState<ReconciliationReport | null>(null);
  const [reconChecking, setReconChecking] = useState(false);
  const [repairReason, setRepairReason] = useState("");
  const [repairMsg, setRepairMsg] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [resBal, resMov] = await Promise.all([
        fetch("/api/v1/inventory"),
        fetch("/api/v1/inventory/movements"),
      ]);

      if (resBal.ok) {
        const json = await resBal.json();
        setBalances(json.data);
        if (json.data.length > 0 && !selectedVariantId) {
          setSelectedVariantId(json.data[0].variantId);
        }
      }
      if (resMov.ok) {
        const json = await resMov.json();
        setMovements(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/inventory/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocationId,
          variantId: selectedVariantId,
          quantity: Number(receiptQty),
          reason: receiptReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to receive stock");

      setShowReceiptModal(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocationId,
          variantId: selectedVariantId,
          quantityDelta: Number(adjustmentDelta),
          reason: adjustmentReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to adjust inventory");

      setShowAdjustmentModal(false);
      setAdjustmentDelta(0);
      setAdjustmentReason("");
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const runReconciliation = async () => {
    setReconChecking(true);
    setRepairMsg(null);
    try {
      const res = await fetch("/api/v1/inventory/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocationId,
          variantId: selectedVariantId,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setReconReport(json.data);
      }
    } finally {
      setReconChecking(false);
    }
  };

  const handleRepair = async () => {
    if (!repairReason) {
      alert("Please provide an audit reason for the discrepancy repair.");
      return;
    }
    try {
      const res = await fetch("/api/v1/inventory/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocationId,
          variantId: selectedVariantId,
          repair: true,
          reason: repairReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRepairMsg("Compensating correction movement posted. Balance successfully resynced.");
        runReconciliation();
        loadData();
      } else {
        alert(data.error?.message || "Repair failed");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Inventory Control & Stock Ledger</h1>
          <p className="text-xs text-slate-400">
            Available = On-Hand &minus; Reserved. Append-only movements and reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReceiptModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-teal-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>Receive Stock</span>
          </button>
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Adjust Inventory</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setTab("balances")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === "balances" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Stock Balances
        </button>
        <button
          onClick={() => setTab("movements")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === "movements" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Movement Ledger
        </button>
        <button
          onClick={() => setTab("reconciliation")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            tab === "reconciliation" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Reconciliation Inspector
        </button>
      </div>

      {/* Tab: Balances */}
      {tab === "balances" && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 font-medium">Location</th>
                  <th className="p-3 font-medium text-right">On-Hand</th>
                  <th className="p-3 font-medium text-right">Reserved</th>
                  <th className="p-3 font-medium text-right">Available</th>
                  <th className="p-3 font-medium text-right">Last Movement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {balances.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-teal-300">{b.sku}</td>
                    <td className="p-3">
                      <span className="font-medium text-white">{b.locationName}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({b.locationCode})</span>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">{b.onHand}</td>
                    <td className="p-3 text-right font-mono text-amber-400">{b.reserved}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                      {b.available}
                    </td>
                    <td className="p-3 text-right text-[11px] text-slate-500">
                      {new Date(b.updatedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Movement Ledger */}
      {tab === "movements" && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden space-y-2">
          <div className="p-3 border-b border-slate-800 text-xs text-slate-400 font-medium">
            Append-Only Historical Movement Ledger (Traceable Invariant Audits)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="p-3 font-medium">Timestamp</th>
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium text-right">Delta</th>
                  <th className="p-3 font-medium">Reference</th>
                  <th className="p-3 font-medium">Reason & Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-mono text-teal-300">{m.sku}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-300">
                        {m.movementType}
                      </span>
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-bold ${
                        m.quantityDelta > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {m.referenceType}: {m.referenceId}
                    </td>
                    <td className="p-3 text-[11px]">
                      <p className="text-slate-200">{m.reason}</p>
                      <p className="text-slate-500">By {m.actorId}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Reconciliation */}
      {tab === "reconciliation" && (
        <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Inventory Balance vs Ledger Audit Check</h2>
            <p className="text-xs text-slate-400">
              Compares operational cache balances with the full ledger historical movement sum.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
            >
              {balances.map((b) => (
                <option key={b.id} value={b.variantId}>
                  {b.sku} ({b.locationCode})
                </option>
              ))}
            </select>

            <button
              onClick={runReconciliation}
              disabled={reconChecking}
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded text-xs transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reconChecking ? "animate-spin" : ""}`} />
              <span>Run Invariant Check</span>
            </button>
          </div>

          {repairMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{repairMsg}</span>
            </div>
          )}

          {reconReport && (
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Reconciliation Result:</span>
                {reconReport.discrepancyDetected ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Discrepancy Detected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ledger & Balance Perfectly Reconciled
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block">Stored On-Hand</span>
                  <span className="text-base font-bold font-mono text-white">{reconReport.storedOnHand}</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block">Calculated Ledger</span>
                  <span className="text-base font-bold font-mono text-teal-400">{reconReport.calculatedOnHand}</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block">Stored Reserved</span>
                  <span className="text-base font-bold font-mono text-amber-400">{reconReport.storedReserved}</span>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block">Discrepancy Delta</span>
                  <span className={`text-base font-bold font-mono ${reconReport.differenceOnHand === 0 ? "text-slate-400" : "text-rose-400"}`}>
                    {reconReport.differenceOnHand}
                  </span>
                </div>
              </div>

              {reconReport.discrepancyDetected && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded space-y-2">
                  <span className="font-semibold text-white block">Authorized Compensating Repair:</span>
                  <input
                    type="text"
                    value={repairReason}
                    onChange={(e) => setRepairReason(e.target.value)}
                    placeholder="Mandatory audit reason for compensating correction..."
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
                  <button
                    onClick={handleRepair}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-semibold rounded text-xs"
                  >
                    Post Compensating Correction Movement
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Receive Stock Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Record Physical Stock Receipt</h3>
            {errorMsg && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleReceipt} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Variant / SKU</label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                >
                  {balances.map((b) => (
                    <option key={b.id} value={b.variantId}>
                      {b.sku} ({b.locationCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Receipt Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={receiptQty}
                  onChange={(e) => setReceiptQty(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Receipt Reason</label>
                <input
                  type="text"
                  required
                  value={receiptReason}
                  onChange={(e) => setReceiptReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-xs bg-teal-500 text-slate-950 font-semibold"
                >
                  Record Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Manual Controlled Adjustment</h3>
            <p className="text-xs text-slate-400">
              Quantity delta (+ or -). Non-empty audit reason required. Cannot result in negative stock.
            </p>
            {errorMsg && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAdjustment} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Variant / SKU</label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                >
                  {balances.map((b) => (
                    <option key={b.id} value={b.variantId}>
                      {b.sku} ({b.locationCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Quantity Delta (e.g. +5 or -2)
                </label>
                <input
                  type="number"
                  required
                  value={adjustmentDelta}
                  onChange={(e) => setAdjustmentDelta(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Reason for Adjustment (Mandatory)
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Cycle count discrepancy, damaged item, etc."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-xs bg-teal-500 text-slate-950 font-semibold"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

