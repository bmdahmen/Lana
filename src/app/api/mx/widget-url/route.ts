import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createMxUser, requestWidgetUrl } from "@/lib/mx";

export async function POST() {
  const db = await getDB();

  const user = await db
    .prepare("SELECT mx_user_guid FROM app_user WHERE id = 1")
    .first<{ mx_user_guid: string | null }>();

  let mxUserGuid = user?.mx_user_guid ?? null;

  if (!mxUserGuid) {
    const mxUser = await createMxUser("lana-single-user");
    mxUserGuid = mxUser.guid;
    await db
      .prepare("UPDATE app_user SET mx_user_guid = ? WHERE id = 1")
      .bind(mxUserGuid)
      .run();
  }

  const widgetUrl = await requestWidgetUrl(mxUserGuid);

  return NextResponse.json({ url: widgetUrl.url });
}
