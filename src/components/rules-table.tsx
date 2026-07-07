"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Rule {
  id: string;
  match_field: "merchant_name" | "name" | "both";
  match_type: "contains" | "equals";
  match_value: string;
  description_value: string | null;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  priority: number;
}

interface RuleDraft {
  matchField: Rule["match_field"];
  matchType: Rule["match_type"];
  matchValue: string;
  descriptionValue: string;
  categoryId: string;
}

function matchFieldLabel(field: Rule["match_field"]): string {
  if (field === "both") return "merchant name & description";
  return field === "merchant_name" ? "merchant name" : "description";
}

function ruleValueSummary(rule: Rule): string {
  if (rule.match_field === "both") {
    return `merchant "${rule.match_value}" & description "${rule.description_value}"`;
  }
  return rule.match_value;
}

function RuleFormFields({
  draft,
  onChange,
  categories,
}: {
  draft: RuleDraft;
  onChange: (patch: Partial<RuleDraft>) => void;
  categories: Category[];
}) {
  const isBoth = draft.matchField === "both";
  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">If</label>
        <select
          value={draft.matchField}
          onChange={(e) => onChange({ matchField: e.target.value as Rule["match_field"] })}
          className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm outline-none sm:w-auto dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="both">merchant name &amp; description</option>
          <option value="merchant_name">merchant name</option>
          <option value="name">description</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Match</label>
        <select
          value={draft.matchType}
          onChange={(e) => onChange({ matchType: e.target.value as Rule["match_type"] })}
          className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm outline-none sm:w-auto dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="contains">contains</option>
          <option value="equals">equals</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">
          {isBoth ? "Merchant value" : "Value"}
        </label>
        <input
          value={draft.matchValue}
          onChange={(e) => onChange({ matchValue: e.target.value })}
          placeholder={isBoth ? "e.g. Chase" : "e.g. CHASE CREDIT CRD PAYMENT"}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {isBoth && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Description value</label>
          <input
            value={draft.descriptionValue}
            onChange={(e) => onChange({ descriptionValue: e.target.value })}
            placeholder="e.g. CREDIT CRD PAYMENT"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Then categorize as</label>
        <select
          value={draft.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value })}
          className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm outline-none sm:w-auto dark:border-zinc-700 dark:bg-zinc-900"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function isDraftValid(draft: RuleDraft): boolean {
  if (!draft.matchValue.trim() || !draft.categoryId) return false;
  if (draft.matchField === "both" && !draft.descriptionValue.trim()) return false;
  return true;
}

export function RulesTable({
  categories,
  initialRules,
}: {
  categories: Category[];
  initialRules: Rule[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [submitting, setSubmitting] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<RuleDraft>({
    matchField: "both",
    matchType: "contains",
    matchValue: "",
    descriptionValue: "",
    categoryId: categories[0]?.id ?? "",
  });

  // The rule tile currently expanded for editing, if any.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RuleDraft | null>(null);

  function openEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditDraft({
      matchField: rule.match_field,
      matchType: rule.match_type,
      matchValue: rule.match_value,
      descriptionValue: rule.description_value ?? "",
      categoryId: rule.category_id,
    });
  }

  function closeEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!isDraftValid(createDraft)) return;
    setSubmitting(true);
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchField: createDraft.matchField,
          matchType: createDraft.matchType,
          matchValue: createDraft.matchValue.trim(),
          descriptionValue:
            createDraft.matchField === "both" ? createDraft.descriptionValue.trim() : undefined,
          categoryId: createDraft.categoryId,
        }),
      });
      setCreateDraft((prev) => ({ ...prev, matchValue: "", descriptionValue: "" }));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!editingId || !editDraft || !isDraftValid(editDraft)) return;
    setSubmitting(true);
    try {
      const descriptionValue = editDraft.matchField === "both" ? editDraft.descriptionValue.trim() : null;
      await fetch(`/api/rules/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchField: editDraft.matchField,
          matchType: editDraft.matchType,
          matchValue: editDraft.matchValue.trim(),
          descriptionValue,
          categoryId: editDraft.categoryId,
        }),
      });
      const category = categories.find((c) => c.id === editDraft.categoryId);
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                match_field: editDraft.matchField,
                match_type: editDraft.matchType,
                match_value: editDraft.matchValue.trim(),
                description_value: descriptionValue,
                category_id: editDraft.categoryId,
                category_name: category?.name ?? r.category_name,
                category_icon: category?.icon ?? r.category_icon,
              }
            : r
        )
      );
      closeEdit();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) closeEdit();
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function applyToExisting() {
    setSubmitting(true);
    setApplyMessage(null);
    try {
      const res = await fetch("/api/rules/apply", { method: "POST" });
      const data = (await res.json()) as { updated?: number };
      setApplyMessage(
        `Updated ${data.updated ?? 0} existing transaction${data.updated === 1 ? "" : "s"}.`
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={createRule}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end dark:border-zinc-800 dark:bg-zinc-950"
      >
        <RuleFormFields
          draft={createDraft}
          onChange={(patch) => setCreateDraft((prev) => ({ ...prev, ...patch }))}
          categories={categories}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Add rule
        </button>
      </form>

      {rules.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No rules yet. Add one above.
        </p>
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div
                  onClick={() => (editingId === rule.id ? closeEdit() : openEdit(rule))}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {ruleValueSummary(rule)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {matchFieldLabel(rule.match_field)} {rule.match_type} → {rule.category_icon}{" "}
                      {rule.category_name}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRule(rule.id);
                    }}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
                {editingId === rule.id && editDraft && (
                  <div className="flex flex-col gap-3 border-t border-zinc-100 p-4 dark:border-zinc-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                      <RuleFormFields
                        draft={editDraft}
                        onChange={(patch) => setEditDraft((prev) => prev && { ...prev, ...patch })}
                        categories={categories}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={submitting}
                        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
                      >
                        Save changes
                      </button>
                      <button
                        onClick={closeEdit}
                        className="rounded-md px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">If</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {rules.map((rule) => (
                  <Fragment key={rule.id}>
                    <tr
                      onClick={() => (editingId === rule.id ? closeEdit() : openEdit(rule))}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {matchFieldLabel(rule.match_field)} {rule.match_type}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {ruleValueSummary(rule)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {rule.category_icon} {rule.category_name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRule(rule.id);
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {editingId === rule.id && editDraft && (
                      <tr>
                        <td colSpan={4} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <RuleFormFields
                                draft={editDraft}
                                onChange={(patch) =>
                                  setEditDraft((prev) => prev && { ...prev, ...patch })
                                }
                                categories={categories}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={submitting}
                                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
                              >
                                Save changes
                              </button>
                              <button
                                onClick={closeEdit}
                                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          onClick={applyToExisting}
          disabled={submitting || rules.length === 0}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          Apply rules to existing transactions
        </button>
        {applyMessage && <span className="text-sm text-zinc-500">{applyMessage}</span>}
      </div>
    </div>
  );
}
