import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET() {
  const db = await getDB();
  const result = await db.prepare("SELECT * FROM category ORDER BY name ASC").all();
  return NextResponse.json({ categories: result.results ?? [] });
}
