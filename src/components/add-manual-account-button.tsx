"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSET_CLASSES,
  PRECIOUS_METALS,
  CRYPTOCURRENCIES,
  type PreciousMetal,
  type Cryptocurrency,
} from "@/lib/asset-classes";
import { formatCurrency } from "@/lib/format";
import type { AddressSuggestion } from "@/lib/zillow";

export function AddManualAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState(ASSET_CLASSES[0].id);
  const [balance, setBalance] = useState("");
  const [preciousMetal, setPreciousMetal] = useState<PreciousMetal>("gold");
  const [troyOz, setTroyOz] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState<Cryptocurrency>("btc");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [spotPrices, setSpotPrices] = useState<Record<PreciousMetal | Cryptocurrency, number> | null>(
    null
  );
  const [propertyAddress, setPropertyAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [manualRealEstateValue, setManualRealEstateValue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suppressSuggestRef = useRef(false);

  const isPreciousMetal = assetClass === "precious_metals";
  const isCrypto = assetClass === "crypto";
  const isRealEstate = assetClass === "real_estate";

  useEffect(() => {
    if ((!isPreciousMetal && !isCrypto) || spotPrices) return;
    fetch("/api/spot-price")
      .then((res) => res.json() as Promise<Record<PreciousMetal | Cryptocurrency, number>>)
      .then(setSpotPrices)
      .catch(() => {});
  }, [isPreciousMetal, isCrypto, spotPrices]);

  useEffect(() => {
    if (!isRealEstate || manualRealEstateValue) return;
    if (suppressSuggestRef.current) {
      suppressSuggestRef.current = false;
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (propertyAddress.trim().length < 5) {
        setAddressSuggestions([]);
        return;
      }
      fetch(`/api/zillow/suggest?q=${encodeURIComponent(propertyAddress)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json() as Promise<{ suggestions: AddressSuggestion[] }>)
        .then((data) => setAddressSuggestions(data.suggestions))
        .catch((err) => {
          if (err?.name !== "AbortError") setAddressSuggestions([]);
        });
    }, 500);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isRealEstate, manualRealEstateValue, propertyAddress]);

  function selectAddressSuggestion(address: string) {
    suppressSuggestRef.current = true;
    setPropertyAddress(address);
    setAddressSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = isPreciousMetal
        ? { name, assetClass, preciousMetal, metalTroyOz: Number(troyOz) }
        : isCrypto
          ? { name, assetClass, cryptoSymbol, cryptoAmount: Number(cryptoAmount) }
          : isRealEstate && !manualRealEstateValue
          ? { name, assetClass, propertyAddress: propertyAddress.replace(/\s*\n+\s*/g, ", ").trim() }
          : { name, assetClass, currentBalance: Number(balance) };
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to add account");
        return;
      }
      setOpen(false);
      setName("");
      setBalance("");
      setTroyOz("");
      setCryptoAmount("");
      setPropertyAddress("");
      setManualRealEstateValue(false);
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
        Add manual account
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Add manual account
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Home, Gold coins, Car loan"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Category
                </label>
                <select
                  value={assetClass}
                  onChange={(e) => setAssetClass(e.target.value as typeof assetClass)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {ASSET_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {isPreciousMetal ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Metal
                    </label>
                    <select
                      value={preciousMetal}
                      onChange={(e) => setPreciousMetal(e.target.value as PreciousMetal)}
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
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Troy ounces
                    </label>
                    <input
                      required
                      type="number"
                      step="0.001"
                      min="0"
                      value={troyOz}
                      onChange={(e) => setTroyOz(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    {spotPrices && Number(troyOz) > 0 && (
                      <p className="mt-1 text-xs text-zinc-500">
                        ≈ {formatCurrency(Number(troyOz) * spotPrices[preciousMetal])} at{" "}
                        {formatCurrency(spotPrices[preciousMetal])}/oz spot
                      </p>
                    )}
                  </div>
                </>
              ) : isCrypto ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Coin
                    </label>
                    <select
                      value={cryptoSymbol}
                      onChange={(e) => setCryptoSymbol(e.target.value as Cryptocurrency)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {CRYPTOCURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Amount
                    </label>
                    <input
                      required
                      type="number"
                      step="0.00000001"
                      min="0"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                      placeholder="e.g. 0.5"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    {spotPrices && Number(cryptoAmount) > 0 && (
                      <p className="mt-1 text-xs text-zinc-500">
                        ≈ {formatCurrency(Number(cryptoAmount) * spotPrices[cryptoSymbol])} at{" "}
                        {formatCurrency(spotPrices[cryptoSymbol])}/{cryptoSymbol.toUpperCase()} spot
                      </p>
                    )}
                  </div>
                </>
              ) : isRealEstate && !manualRealEstateValue ? (
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Property address
                  </label>
                  <textarea
                    required
                    rows={2}
                    autoComplete="street-address"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    onBlur={() => setAddressSuggestions([])}
                    placeholder="e.g. 1600 Pennsylvania Ave NW, Washington, DC 20500"
                    className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  {addressSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-zinc-300 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {addressSuggestions.map((s) => (
                        <li key={s.zpid}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectAddressSuggestion(s.address)}
                            className="block w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            {s.address}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-zinc-500">
                    The balance is set from Zillow&apos;s Zestimate for this address and refreshes automatically.{" "}
                    <button
                      type="button"
                      onClick={() => setManualRealEstateValue(true)}
                      className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      Enter a value manually instead.
                    </button>
                  </p>
                </div>
              ) : isRealEstate ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Current value
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="e.g. 750000"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setManualRealEstateValue(false)}
                      className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      Look up automatically from Zillow instead.
                    </button>
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Current balance
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="Liabilities: enter a positive amount owed"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              )}
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
                  {submitting ? "Adding..." : "Add account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
