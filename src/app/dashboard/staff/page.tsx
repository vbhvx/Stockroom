"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Shield, ShieldCheck, Check, X, AlertCircle } from "lucide-react";
import { ROLE_PERMISSIONS, Role, Permission } from "@/server/authorization/roles";

interface StaffMember {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  storeName: string | null;
  createdAt: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("order_manager");
  const [actionError, setActionError] = useState<string | null>(null);

  const loadStaff = async () => {
    try {
      const res = await fetch("/api/v1/staff");
      if (res.ok) {
        const json = await res.json();
        setStaff(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetch("/api/v1/staff/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to invite staff member");

      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      loadStaff();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: Role) => {
    try {
      const res = await fetch(`/api/v1/staff/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || "Role change failed");
        return;
      }
      loadStaff();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemove = async (membershipId: string) => {
    if (!confirm("Are you sure you want to revoke this staff member's access?")) return;

    try {
      const res = await fetch(`/api/v1/staff/${membershipId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || "Removal failed");
        return;
      }
      loadStaff();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const allRoles: Role[] = [
    "owner",
    "admin",
    "catalog_manager",
    "inventory_manager",
    "order_manager",
    "fulfillment_staff",
    "finance_staff",
    "support_staff",
    "viewer",
  ];

  const allPermissions: Permission[] = [
    "canManageCatalog",
    "canChangePrice",
    "canReceiveStock",
    "canAdjustInventory",
    "canManageReservations",
    "canViewOrder",
    "canCancelOrder",
    "canInitiateRefund",
    "canApproveRefund",
    "canDispatchFulfillment",
    "canManageStaff",
    "canViewAuditHistory",
    "canExportData",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Staff Roles & Access Control</h1>
          <p className="text-xs text-slate-400">
            Granular permission policies, tenant isolation, and strict ownership safeguards.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-teal-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>Invite Staff</span>
        </button>
      </div>

      {/* Staff Members List */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-800 text-xs font-semibold text-white">
          Active Organization Members
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Store Scope</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {staff.map((m) => (
                <tr key={m.membershipId} className="hover:bg-slate-800/30">
                  <td className="p-3 font-semibold text-white">{m.name}</td>
                  <td className="p-3 font-mono text-slate-400">{m.email}</td>
                  <td className="p-3 text-slate-400">{m.storeName || "All Organization Stores"}</td>
                  <td className="p-3">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.membershipId, e.target.value as Role)}
                      className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-teal-300 text-xs font-medium capitalize"
                    >
                      {allRoles.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    {m.role !== "owner" && (
                      <button
                        onClick={() => handleRemove(m.membershipId)}
                        className="text-[11px] text-rose-400 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Granular Permission Matrix Inspector */}
      <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-400" />
            Centralized Granular Permission Matrix (Backend Enforced)
          </h2>
          <p className="text-xs text-slate-400">
            Every operational endpoint validates server-side permissions independently of client-submitted parameters.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="p-2 font-medium">Granular Permission</th>
                {allRoles.map((r) => (
                  <th key={r} className="p-2 font-medium capitalize text-center">
                    {r.replace("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {allPermissions.map((perm) => (
                <tr key={perm} className="hover:bg-slate-800/20">
                  <td className="p-2 font-mono text-teal-300">{perm}</td>
                  {allRoles.map((role) => {
                    const has = ROLE_PERMISSIONS[role]?.includes(perm);
                    return (
                      <td key={role} className="p-2 text-center">
                        {has ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-slate-600">&bull;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4 text-xs">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-400" />
              Invite New Staff Member
            </h3>
            {actionError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                {actionError}
              </div>
            )}
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Rachel Green"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="rachel@stockroom.internal"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Assigned Operational Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-white capitalize"
                >
                  {allRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-teal-500 text-slate-950 font-semibold"
                >
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

