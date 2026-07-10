import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSpotPriceHistory } from "@/lib/spot-price";
import { PRECIOUS_METALS, type PreciousMetal } from "@/lib/asset-classes";

function isPreciousMetal(value: string): value is PreciousMetal {
  return (PRECIOUS_METALS as readonly string[]).includes(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  if (!isPreciousMetal(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const db = await getDB();
  const history = await getSpotPriceHistory(db, symbol);
  return NextResponse.json({ history });
}
