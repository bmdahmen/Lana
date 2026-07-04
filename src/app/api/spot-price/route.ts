import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSpotPrices } from "@/lib/spot-price";

export async function GET() {
  const db = await getDB();
  const prices = await getSpotPrices(db);
  return NextResponse.json(prices);
}
