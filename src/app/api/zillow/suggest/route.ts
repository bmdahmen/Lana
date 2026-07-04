import { NextResponse } from "next/server";
import { suggestAddresses } from "@/lib/zillow";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestAddresses(query);
  return NextResponse.json({ suggestions });
}
