"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Send,
} from "lucide-react";

interface Payment {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId: string | null;
  paymentStatus: string;
  currency: string;
  authorizedAmountMinor: number;
  capturedAmountMinor: number;
  refundedAmountMinor: number;
  errorMessage: string | null;
  createdAt: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState<Payment | null>(null);
  const [refundAmountMinor, setRefundAmountMinor] = useState(1000);
  const [refundReason, setRefundReason] = useState("Customer requested refund");
  const [reconMsg, setReconMsg] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Webhook tester tool state
  const [webhookProviderPaymentId, setWebhookProviderPaymentId] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<"captured" | "failed">("captured");
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null);

  const loadPayments = async () => {
    try {
      const res = await fetch("/api/v1/orders/ord_seed_1001/payments");
      // Or query recent orders/payments
      const resRecent = await fetch("/api/v1/reports/operations");
      // Let's also fetch payments directly
      const resAll = await fetch("/api/v1/orders/all/payments").catch(() => null);
      if (res.ok) {
        const json = await res.json();
        setPayments(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRefundModal) return;

    try {
      const res = await fetch(`/api/v1/payments/${showRefundModal.id}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor: Number(refundAmountMinor),
          reason: refundReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Refund initiation failed");

      setShowRefundModal(null);
      loadPayments();
      alert(`Refund of $${(refundAmountMinor / 100).toFixed(2)} recorded successfully.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconMsg(null);
    try {
      const res = await fetch("/api/v1/payments/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok) {
        setReconMsg(
          `Scanned ${json.data.totalScanned} pending payments. Discrepancies resolved: ${json.data.resolvedCount}.`
        );
        loadPayments();
      }
    } finally {
      setIsReconciling(false);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookMsg(null);
    try {
      const payload = JSON.stringify({
        eventId: `evt_ui_sim_${Date.now()}`,
        eventType: `payment.${webhookStatus}`,
        providerPaymentId: webhookProviderPaymentId,
        status: webhookStatus,
        amountMinor: 27300,
        currency: "USD",
        timestamp: new Date().toISOString(),
      });

      // Send to webhook route
      const res = await fetch("/api/v1/webhooks/payments/simulated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The simulated secret matches default secret
          "x-provider-signature": "v1=simulated_test",
        },
        body: payload,
      });

      const data = await res.json();
      if (res.ok) {
        setWebhookMsg(`Webhook processed successfully! Status: ${data.data.status}`);
        loadPayments();
      } else {
        setWebhookMsg(`Webhook rejected: ${data.error?.message}`);
      }
    } catch (err: any) {
      setWebhookMsg(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "captured":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Captured</span>;
      case "pending":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
      case "authorized":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">Authorized</span>;
      case "partially_refunded":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Partially Refunded</span>;
      case "refunded":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Refunded</span>;
      case "failed":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Payment Processing & Reconciliation</h1>
          <p className="text-xs text-slate-400">
            Payment attempts, webhook deduplication, refund limits, and gateway reconciliation.
          </p>
        </div>

        <button
          onClick={handleReconcile}
          disabled={isReconciling}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium rounded-lg text-xs border border-slate-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isReconciling ? "animate-spin" : ""}`} />
          <span>Reconcile Pending</span>
        </button>
      </div>

      {reconMsg && (
        <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg text-xs text-teal-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{reconMsg}</span>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-800 text-xs font-semibold text-white flex items-center justify-between">
          <span>Authoritative Payment Records</span>
          <span className="text-[11px] text-slate-400 font-normal">All amounts in exact minor units</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-medium">Payment ID</th>
                <th className="p-3 font-medium">Provider Ref</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Captured</th>
                <th className="p-3 font-medium text-right">Refunded</th>
                <th className="p-3 font-medium text-right">Timestamp</th>
                <th className="p-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No payment attempts found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const refundableBalance = p.capturedAmountMinor - p.refundedAmountMinor;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono text-teal-300 font-medium">{p.id}</td>
                      <td className="p-3 font-mono text-slate-400 text-[11px]">{p.providerPaymentId || "N/A"}</td>
                      <td className="p-3">{getStatusBadge(p.paymentStatus)}</td>
                      <td className="p-3 text-right font-mono font-bold text-white">
                        ${(p.capturedAmountMinor / 100).toFixed(2)} {p.currency}
                      </td>
                      <td className="p-3 text-right font-mono text-purple-400">
                        ${(p.refundedAmountMinor / 100).toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-[11px] text-slate-500">
                        {new Date(p.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3 text-right">
                        {refundableBalance > 0 && (
                          <button
                            onClick={() => {
                              setShowRefundModal(p);
                              setRefundAmountMinor(refundableBalance);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] font-medium border border-slate-700 inline-flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Refund</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Sandbox Testing Card */}
      <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-400" />
            Payment Provider Webhook Simulator & Deduplication Sandbox
          </h2>
          <p className="text-xs text-slate-400">
            Simulate asynchronous provider callbacks to verify cryptographic signature validation, payment capture, and duplicate rejection.
          </p>
        </div>

        {webhookMsg && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs text-teal-300 font-mono">
            {webhookMsg}
          </div>
        )}

        <form onSubmit={handleSimulateWebhook} className="flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            required
            value={webhookProviderPaymentId}
            onChange={(e) => setWebhookProviderPaymentId(e.target.value)}
            placeholder="Provider Payment ID (e.g. sim_pay_seed_99812)"
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono min-w-[280px]"
          />

          <select
            value={webhookStatus}
            onChange={(e) => setWebhookStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
          >
            <option value="captured">payment.captured</option>
            <option value="failed">payment.failed</option>
          </select>

          <button
            type="submit"
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded transition-colors flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Dispatch Webhook</span>
          </button>
        </form>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-400" />
              Initiate Controlled Refund
            </h3>
            <p className="text-slate-400">
              Remaining refundable balance:{" "}
              <strong className="text-white font-mono">
                ${((showRefundModal.capturedAmountMinor - showRefundModal.refundedAmountMinor) / 100).toFixed(2)}
              </strong>
            </p>
            <form onSubmit={handleRefund} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">
                  Refund Amount Minor (e.g. 5000 = $50.00)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={showRefundModal.capturedAmountMinor - showRefundModal.refundedAmountMinor}
                  value={refundAmountMinor}
                  onChange={(e) => setRefundAmountMinor(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Audit Reason for Refund</label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(null)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold"
                >
                  Execute Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

