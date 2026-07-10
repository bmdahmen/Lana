import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getGsrHistory } from "@/lib/spot-price";

export async function GET() {
  const db = await getDB();
  const history = await getGsrHistory(db);
  return NextResponse.json({ history });
}
