"use client";

import { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  Package,
  CheckCircle2,
  AlertTriangle,
  Send,
  Boxes,
} from "lucide-react";

interface FulfillmentItem {
  id: string;
  orderId: string;
  orderNumber: string;
  locationCode: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  createdAt: string;
}

export default function FulfillmentPage() {
  const [fulfillments, setFulfillments] = useState<FulfillmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShipModal, setShowShipModal] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("FedEx Ground");
  const [trackingNumber, setTrackingNumber] = useState("");

  const [showExceptionModal, setShowExceptionModal] = useState<string | null>(null);
  const [exceptionType, setExceptionType] = useState("shortage");
  const [exceptionReason, setExceptionReason] = useState("");

  const loadFulfillments = async () => {
    try {
      const res = await fetch("/api/v1/fulfillments");
      if (res.ok) {
        const json = await res.json();
        setFulfillments(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFulfillments();
  }, []);

  const handlePick = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/fulfillments/${id}/pick`, { method: "POST" });
      if (res.ok) loadFulfillments();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePack = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/fulfillments/${id}/pack`, { method: "POST" });
      if (res.ok) loadFulfillments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showShipModal) return;

    try {
      const res = await fetch(`/api/v1/fulfillments/${showShipModal}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, trackingNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Shipment confirmation failed");

      setShowShipModal(null);
      setTrackingNumber("");
      loadFulfillments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showExceptionModal) return;

    try {
      const res = await fetch(`/api/v1/fulfillments/${showExceptionModal}/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptionType, reason: exceptionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to log exception");

      setShowExceptionModal(null);
      setExceptionReason("");
      alert("Fulfillment exception logged for warehouse review.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Pick</span>;
      case "picking":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">Picking In Progress</span>;
      case "packed":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Packed & Staged</span>;
      case "shipped":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Shipped</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Fulfillment & Dispatch Pipeline</h1>
          <p className="text-xs text-slate-400">
            Picking, packing, carrier dispatch, tracking updates, and stock deduction.
          </p>
        </div>
      </div>

      {/* Fulfillments Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-medium">Fulfillment ID</th>
                <th className="p-3 font-medium">Order Number</th>
                <th className="p-3 font-medium">Location</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Carrier & Tracking</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {fulfillments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No active fulfillment orders in queue.
                  </td>
                </tr>
              ) : (
                fulfillments.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-teal-300 font-medium">{f.id}</td>
                    <td className="p-3 font-mono text-white font-semibold">{f.orderNumber}</td>
                    <td className="p-3 font-mono text-slate-400">{f.locationCode}</td>
                    <td className="p-3">{getStatusBadge(f.status)}</td>
                    <td className="p-3 text-[11px] font-mono text-slate-400">
                      {f.carrier ? `${f.carrier} - ${f.trackingNumber}` : "Unassigned"}
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {f.status === "pending" && (
                        <button
                          onClick={() => handlePick(f.id)}
                          className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-medium"
                        >
                          Start Pick
                        </button>
                      )}
                      {f.status === "picking" && (
                        <button
                          onClick={() => handlePack(f.id)}
                          className="px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-medium"
                        >
                          Mark Packed
                        </button>
                      )}
                      {f.status === "packed" && (
                        <button
                          onClick={() => {
                            setShowShipModal(f.id);
                            setTrackingNumber(`TRK${Date.now().toString().slice(-8)}`);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold"
                        >
                          Confirm Dispatch
                        </button>
                      )}
                      {f.status !== "shipped" && f.status !== "delivered" && (
                        <button
                          onClick={() => setShowExceptionModal(f.id)}
                          className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-800"
                          title="Log exception"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ship Confirmation Modal */}
      {showShipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-400" />
              Confirm Carrier Dispatch & Deduct Stock
            </h3>
            <p className="text-slate-400">
              Confirming shipment will atomically deduct both on-hand and reserved inventory movements for all package line items.
            </p>
            <form onSubmit={handleShip} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Carrier Name</label>
                <input
                  type="text"
                  required
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Tracking Number</label>
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShipModal(null)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                >
                  Confirm Shipment & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Exception Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Flag Fulfillment Exception
            </h3>
            <form onSubmit={handleLogException} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Exception Category</label>
                <select
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                >
                  <option value="shortage">Item Shortage / Missing Units</option>
                  <option value="damaged">Damaged in Warehouse</option>
                  <option value="carrier_error">Carrier Refusal / Error</option>
                  <option value="address_issue">Address Unreachable</option>
                  <option value="other">Other Operational Exception</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Detailed Explanation</label>
                <textarea
                  required
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                  placeholder="Explain the operational issue for investigation..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(null)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
                >
                  Log Exception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

