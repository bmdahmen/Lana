import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { syncEraAccounts } from "@/lib/era-sync";

export async function POST() {
  const db = await getDB();
  try {
    const result = await syncEraAccounts(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
