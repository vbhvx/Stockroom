"use client";

import { useEffect, useState } from "react";
import { ScrollText, Search, Filter, ShieldCheck, Eye } from "lucide-react";

interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const loadEvents = async () => {
    try {
      const q = resourceFilter ? `?resourceType=${resourceFilter}` : "";
      const res = await fetch(`/api/v1/audit-events${q}`);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [resourceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Immutable Operational Audit Log</h1>
          <p className="text-xs text-slate-400">
            Append-only record of every state transition, inventory movement, price change, and staff mutation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
          >
            <option value="">All Resource Types</option>
            <option value="order">Order</option>
            <option value="inventory_balance">Inventory Balance</option>
            <option value="payment">Payment</option>
            <option value="refund">Refund</option>
            <option value="fulfillment">Fulfillment</option>
            <option value="product">Product</option>
            <option value="staff_membership">Staff Membership</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-medium">Timestamp (UTC / Local)</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Resource</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Audit Reason / Note</th>
                <th className="p-3 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="font-mono font-bold text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 text-[11px]">
                        {evt.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 font-mono text-[11px]">
                      {evt.resourceType} ({evt.resourceId.slice(0, 16)}...)
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">{evt.actorId}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{evt.reason || "-"}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium text-[11px] border border-slate-700/60 inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Diff</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Diff Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-3xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-400" />
                  Audit Record: {selectedEvent.action}
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Actor: <span className="font-mono text-teal-300">{selectedEvent.actorId}</span> &bull; Time:{" "}
                  {new Date(selectedEvent.createdAt).toISOString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close &times;
              </button>
            </div>

            {selectedEvent.reason && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Stated Reason:</span>
                {selectedEvent.reason}
              </div>
            )}

            {/* Before vs After Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Before State Snapshot
                </span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 font-mono overflow-x-auto max-h-72">
                  {selectedEvent.beforeState
                    ? JSON.stringify(selectedEvent.beforeState, null, 2)
                    : "// No previous state (Creation event)"}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-teal-400 block mb-1">
                  After State Snapshot
                </span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-teal-300 font-mono overflow-x-auto max-h-72">
                  {selectedEvent.afterState
                    ? JSON.stringify(selectedEvent.afterState, null, 2)
                    : "// No resulting state (Deletion event)"}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

