"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Package,
  ArrowRight,
  Eye,
} from "lucide-react";

interface OrderLine {
  id: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  quantityOrdered: number;
  quantityFulfilled: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

interface Order {
  id: string;
  orderNumber: string;
  orderStatus: string;
  currency: string;
  totalMinor: number;
  subtotalMinor: number;
  shippingMinor: number;
  customerReference: string;
  createdAt: string;
  cancelledAt: string | null;
  lines: OrderLine[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("Customer requested cancellation");

  // New order form
  const [customerRef, setCustomerRef] = useState("");
  const [orderVariantId, setOrderVariantId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [availableVariants, setAvailableVariants] = useState<Array<{ id: string; sku: string }>>([]);

  const loadOrders = async () => {
    try {
      const q = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/v1/orders${q}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadVariants = async () => {
    const res = await fetch("/api/v1/products");
    if (res.ok) {
      const json = await res.json();
      const vars: Array<{ id: string; sku: string }> = [];
      for (const p of json.data) {
        for (const v of p.variants || []) {
          vars.push({ id: v.id, sku: v.sku });
        }
      }
      setAvailableVariants(vars);
      if (vars.length > 0 && !orderVariantId) {
        setOrderVariantId(vars[0].id);
      }
    }
  };

  useEffect(() => {
    loadOrders();
    loadVariants();
  }, [statusFilter]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: "store_nyc",
          locationId: "loc_nj_warehouse",
          customerReference: customerRef,
          lines: [{ variantId: orderVariantId, quantity: Number(orderQuantity) }],
          shippingMinor: 1500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create order");

      setShowCreateModal(false);
      setCustomerRef("");
      loadOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Order confirmed by operator" }),
      });
      if (res.ok) {
        loadOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updated = await res.json();
          setSelectedOrder({ ...selectedOrder, orderStatus: updated.data.orderStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: "loc_nj_warehouse",
          reason: cancelReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to cancel order");

      setShowCancelModal(null);
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, orderStatus: "cancelled" });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
      case "confirmed":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">Confirmed</span>;
      case "processing":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">Processing</span>;
      case "fulfilled":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Fulfilled</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Order Management Workspace</h1>
          <p className="text-xs text-slate-400">
            Validated order lifecycle, line snapshots, and transactional inventory reservations.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-teal-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>New Order</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs overflow-x-auto">
        {["all", "pending", "confirmed", "processing", "fulfilled", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
              statusFilter === s
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-medium">Order Number</th>
                <th className="p-3 font-medium">Customer Reference</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Items</th>
                <th className="p-3 font-medium text-right">Total</th>
                <th className="p-3 font-medium text-right">Created At</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No orders match the current filter.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-teal-300">{o.orderNumber}</td>
                    <td className="p-3 font-medium text-slate-200">{o.customerReference}</td>
                    <td className="p-3">{getStatusBadge(o.orderStatus)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      {o.lines?.reduce((acc, l) => acc + l.quantityOrdered, 0) || 0}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      ${(o.totalMinor / 100).toFixed(2)} {o.currency}
                    </td>
                    <td className="p-3 text-right text-[11px] text-slate-500">
                      {new Date(o.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium text-[11px] border border-slate-700/60 inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Order {selectedOrder.orderNumber}</span>
                  {getStatusBadge(selectedOrder.orderStatus)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customer: {selectedOrder.customerReference} &bull; Placed: {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close &times;
              </button>
            </div>

            {/* Preserved Line Items Snapshot */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Line Items Snapshot (Frozen Historical Pricing)
              </h4>
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 divide-y divide-slate-800/60">
                {selectedOrder.lines?.map((line) => (
                  <div key={line.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-white">{line.productNameSnapshot}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        SKU: {line.skuSnapshot} &bull; Qty Ordered: {line.quantityOrdered} (Fulfilled: {line.quantityFulfilled})
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-semibold text-white">
                        ${(line.lineTotalMinor / 100).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        @ ${(line.unitPriceMinor / 100).toFixed(2)} / unit
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">${(selectedOrder.subtotalMinor / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping:</span>
                <span className="font-mono">${(selectedOrder.shippingMinor / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                <span>Total:</span>
                <span className="font-mono text-teal-300">
                  ${(selectedOrder.totalMinor / 100).toFixed(2)} {selectedOrder.currency}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {selectedOrder.orderStatus === "pending" && (
                  <button
                    onClick={() => handleConfirmOrder(selectedOrder.id)}
                    className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded text-xs"
                  >
                    Confirm Order
                  </button>
                )}
                {selectedOrder.orderStatus !== "cancelled" && selectedOrder.orderStatus !== "fulfilled" && (
                  <button
                    onClick={() => setShowCancelModal(selectedOrder.id)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-semibold"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Create New Order</h3>
            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Customer Name / Reference</label>
                <input
                  type="text"
                  required
                  value={customerRef}
                  onChange={(e) => setCustomerRef(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Select Variant / SKU</label>
                <select
                  value={orderVariantId}
                  onChange={(e) => setOrderVariantId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                >
                  {availableVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-teal-500 text-slate-950 font-semibold"
                >
                  Create & Reserve Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Ban className="h-4 w-4 text-rose-400" />
              Cancel Order & Release Reservations
            </h3>
            <p className="text-slate-400">
              This action will cancel the order and return any unshipped reserved stock back to the available inventory pool exactly once.
            </p>
            <div>
              <label className="block text-slate-300 mb-1">Audit Reason for Cancellation</label>
              <input
                type="text"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(null)}
                className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => handleCancelOrder(showCancelModal)}
                className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-400 text-white font-semibold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

