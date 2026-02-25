"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Tag, Archive, Check, AlertCircle } from "lucide-react";

interface Variant {
  id: string;
  sku: string;
  barcode: string | null;
  unitOfMeasure: string;
  status: string;
  prices?: Array<{ id: string; currency: string; amountMinor: number }>;
  inventory?: Array<{ locationId: string; onHand: number; reserved: number; available: number }>;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  status: string;
  variants: Variant[];
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState<string | null>(null);

  // Form states
  const [newProductName, setNewProductName] = useState("");
  const [newProductSlug, setNewProductSlug] = useState("");
  const [newProductBrand, setNewProductBrand] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");

  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantBarcode, setNewVariantBarcode] = useState("");
  const [newVariantPriceMinor, setNewVariantPriceMinor] = useState(9900);

  const [actionError, setActionError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/v1/products${q}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProductName,
          slug: newProductSlug || newProductName.toLowerCase().replace(/\s+/g, "-"),
          brand: newProductBrand,
          description: newProductDesc,
          status: "active",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create product");

      setShowCreateModal(false);
      setNewProductName("");
      setNewProductSlug("");
      setNewProductBrand("");
      setNewProductDesc("");
      loadProducts();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent, productId: string) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: newVariantSku,
          barcode: newVariantBarcode || undefined,
          price: {
            storeId: "store_nyc",
            currency: "USD",
            amountMinor: Number(newVariantPriceMinor),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create variant");

      setShowVariantModal(null);
      setNewVariantSku("");
      setNewVariantBarcode("");
      loadProducts();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleArchiveProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to archive this product? Historical orders and movements will be preserved.")) return;
    try {
      const res = await fetch(`/api/v1/products/${productId}/archive`, {
        method: "POST",
      });
      if (res.ok) {
        loadProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Product Catalog & SKU Registry</h1>
          <p className="text-xs text-slate-400">
            Maintain sellable products, variants, SKUs, and pricing in exact minor units.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-teal-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>New Product</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name, brand, or slug..."
          className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Product List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading catalog...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No products match the search filter.
          </div>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">{p.name}</h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        p.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{p.brand} &bull; <span className="font-mono text-slate-500">/{p.slug}</span></p>
                  {p.description && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{p.description}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowVariantModal(p.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-medium border border-slate-700/60"
                  >
                    + Add Variant
                  </button>
                  {p.status !== "archived" && (
                    <button
                      onClick={() => handleArchiveProduct(p.id)}
                      title="Archive product"
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Variants table */}
              <div className="overflow-x-auto border-t border-slate-800/80 pt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800/60">
                      <th className="pb-2 font-medium">SKU</th>
                      <th className="pb-2 font-medium">Barcode</th>
                      <th className="pb-2 font-medium">Attributes</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {p.variants?.map((v) => (
                      <tr key={v.id} className="text-slate-300">
                        <td className="py-2 font-mono font-medium text-teal-300">{v.sku}</td>
                        <td className="py-2 font-mono text-slate-400">{v.barcode || "-"}</td>
                        <td className="py-2 text-slate-400">
                          {v.unitOfMeasure}
                        </td>
                        <td className="py-2">
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Create New Catalog Product</h3>
            {actionError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {actionError}
              </div>
            )}
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  placeholder="e.g. Waterproof Technical Backpack"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Brand</label>
                <input
                  type="text"
                  value={newProductBrand}
                  onChange={(e) => setNewProductBrand(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  placeholder="Stockroom Gear"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Description</label>
                <textarea
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-xs bg-teal-500 text-slate-950 font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Variant Modal */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Add Sellable Variant</h3>
            {actionError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {actionError}
              </div>
            )}
            <form onSubmit={(e) => handleCreateVariant(e, showVariantModal)} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Unique SKU</label>
                <input
                  type="text"
                  required
                  value={newVariantSku}
                  onChange={(e) => setNewVariantSku(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                  placeholder="e.g. PACK-30L-BLK"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Barcode / UPC</label>
                <input
                  type="text"
                  value={newVariantBarcode}
                  onChange={(e) => setNewVariantBarcode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                  placeholder="8901234567890"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Price in Minor Units (e.g. 12900 = $129.00 USD)
                </label>
                <input
                  type="number"
                  required
                  value={newVariantPriceMinor}
                  onChange={(e) => setNewVariantPriceMinor(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(null)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-xs bg-teal-500 text-slate-950 font-semibold"
                >
                  Create Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

