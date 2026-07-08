"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRECIOUS_METALS, type PreciousMetal } from "@/lib/asset-classes";
import { METAL_ITEM_CATEGORIES, type MetalItem, type MetalItemCategory } from "@/lib/metal-items";
import { formatCurrency, formatTroyOz } from "@/lib/format";

interface FormState {
  metal: PreciousMetal;
  category: MetalItemCategory;
  name: string;
  mint: string;
  year: string;
  condition: string;
  quantity: string;
  troyOzEach: string;
  faceValueEach: string;
  purchasePriceTotal: string;
  purchaseDate: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    metal: "silver",
    category: "bullion_coin",
    name: "",
    mint: "",
    year: "",
    condition: "",
    quantity: "1",
    troyOzEach: "1",
    faceValueEach: "",
    purchasePriceTotal: "",
    purchaseDate: "",
    notes: "",
  };
}

function formFromItem(item: MetalItem): FormState {
  return {
    metal: item.metal,
    category: item.category,
    name: item.name,
    mint: item.mint ?? "",
    year: item.year != null ? String(item.year) : "",
    condition: item.condition ?? "",
    quantity: String(item.quantity),
    troyOzEach: String(item.troy_oz_each),
    faceValueEach: item.face_value_each != null ? String(item.face_value_each) : "",
    purchasePriceTotal: item.purchase_price_total != null ? String(item.purchase_price_total) : "",
    purchaseDate: item.purchase_date ?? "",
    notes: item.notes ?? "",
  };
}

function toBody(form: FormState) {
  return {
    metal: form.metal,
    category: form.category,
    name: form.name.trim(),
    mint: form.mint.trim() || undefined,
    year: form.year ? Number(form.year) : undefined,
    condition: form.condition.trim() || undefined,
    quantity: Number(form.quantity),
    troyOzEach: Number(form.troyOzEach),
    faceValueEach: form.faceValueEach ? Number(form.faceValueEach) : undefined,
    purchasePriceTotal: form.purchasePriceTotal ? Number(form.purchasePriceTotal) : undefined,
    purchaseDate: form.purchaseDate || undefined,
    notes: form.notes.trim() || undefined,
  };
}

function FormFields({
  form,
  setForm,
  spotPrices,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  spotPrices: Record<PreciousMetal, number> | null;
}) {
  const qty = Number(form.quantity) || 0;
  const ozEach = Number(form.troyOzEach) || 0;
  const totalOz = qty * ozEach;
  const estValue = spotPrices ? totalOz * spotPrices[form.metal] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Metal</label>
          <select
            value={form.metal}
            onChange={(e) => setForm((f) => ({ ...f, metal: e.target.value as PreciousMetal }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {PRECIOUS_METALS.map((m) => (
              <option key={m} value={m}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as MetalItemCategory }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {METAL_ITEM_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. American Silver Eagle"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mint</label>
          <input
            value={form.mint}
            onChange={(e) => setForm((f) => ({ ...f, mint: e.target.value }))}
            placeholder="US"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Year</label>
          <input
            type="number"
            inputMode="numeric"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            placeholder="2024"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Condition</label>
          <input
            value={form.condition}
            onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            placeholder="Uncirculated"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Quantity</label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Troy oz each
          </label>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            value={form.troyOzEach}
            onChange={(e) => setForm((f) => ({ ...f, troyOzEach: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-500">
        Troy oz per single item — 1 for a standard 1 oz coin, 0.715 for $1 face value of 90% silver
        coinage, 32.15 for a kilo bar or coin.
        {estValue !== null && totalOz > 0 && (
          <> ≈ {formatCurrency(estValue)} at today&apos;s spot for {totalOz.toFixed(3)} oz total.</>
        )}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Face value each
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.faceValueEach}
            onChange={(e) => setForm((f) => ({ ...f, faceValueEach: e.target.value }))}
            placeholder="Optional"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Total paid
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.purchasePriceTotal}
            onChange={(e) => setForm((f) => ({ ...f, purchasePriceTotal: e.target.value }))}
            placeholder="Optional"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Purchase date
          </label>
          <input
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Optional"
          className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
    </>
  );
}

export function AddMetalItemButton({ spotPrices }: { spotPrices: Record<PreciousMetal, number> | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/metal-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(form)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to add item");
        return;
      }
      setOpen(false);
      setForm(emptyForm());
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Add item
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Add item</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormFields form={form} setForm={setForm} spotPrices={spotPrices} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
                >
                  {submitting ? "Adding..." : "Add item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function EditMetalItemModal({
  item,
  onClose,
  spotPrices,
}: {
  item: MetalItem;
  onClose: () => void;
  spotPrices: Record<PreciousMetal, number> | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => formFromItem(item));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/metal-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(form)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to save item");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${item.name} from the collection?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/metal-items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to delete item");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Edit item</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormFields form={form} setForm={setForm} spotPrices={spotPrices} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? "Removing..." : "Remove"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * The fast path for "I bought more of a coin/bar I already track" -- just
 * the quantity, with +/- steppers, shown inline below a tapped holdings row
 * (same expand-in-place pattern as the Rules tab) rather than a modal.
 * "Edit full details" drops into the full EditMetalItemModal for everything
 * else (condition, purchase price, notes, ...).
 */
export function QuickEditQuantityFields({
  item,
  onSaved,
  onCancel,
  onEditFullDetails,
  spotPrices,
}: {
  item: MetalItem;
  onSaved: () => void;
  onCancel: () => void;
  onEditFullDetails: () => void;
  spotPrices: Record<PreciousMetal, number> | null;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity) || 0;
  const totalOz = qty * item.troy_oz_each;
  const estValue = spotPrices ? totalOz * spotPrices[item.metal] : null;

  function adjust(delta: number) {
    setQuantity((prev) => String(Math.max(0, (Number(prev) || 0) + delta)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/metal-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to update quantity");
        return;
      }
      onSaved();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Quantity</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjust(-1)}
            aria-label="Decrease quantity"
            className="h-9 w-9 shrink-0 rounded-md border border-zinc-300 text-lg font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            −
          </button>
          <input
            required
            type="number"
            inputMode="numeric"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-center text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={() => adjust(1)}
            aria-label="Increase quantity"
            className="h-9 w-9 shrink-0 rounded-md border border-zinc-300 text-lg font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            +
          </button>
          <span className="text-xs text-zinc-500">
            {formatTroyOz(totalOz)}
            {estValue !== null && <> ≈ {formatCurrency(estValue)}</>}
          </span>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onEditFullDetails}
          className="text-xs font-medium text-zinc-400 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Edit full details
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
