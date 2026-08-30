import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { userApiKeys } from "@/db/schema/users";
import { eq, and } from "drizzle-orm";
import { decryptKey } from "@/lib/encryption";
import { getLiveModels } from "@/lib/ai/registry";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get("provider");

    if (!providerId) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 });
    }

    const keyRecord = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, session.user.id),
        eq(userApiKeys.provider, providerId)
      ),
    });

    if (!keyRecord) {
      return NextResponse.json({ error: "No usable API key configured for this provider." }, { status: 403 });
    }

    let apiKey = "";
    try {
      apiKey = decryptKey(keyRecord.encryptedKey, keyRecord.iv);
    } catch (e) {
      return NextResponse.json({ error: "Failed to decrypt API key." }, { status: 500 });
    }

    const models = await getLiveModels(providerId, apiKey);
    return NextResponse.json({ models });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}
