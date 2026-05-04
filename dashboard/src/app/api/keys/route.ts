import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import crypto from "crypto"
import { hashApiKey } from "@/lib/hashApiKey"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKeys = await (prisma.apiKey as any).findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        // key is intentionally excluded — plaintext is shown once at creation only
        sponsorshipPolicy: true,
        markupPercentage: true,
        maxSponsoredTxsPerUser: true,
        monthlyLimitUsd: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ apiKeys })
  } catch (error: any) {
    console.error("Dashboard API: Failed to fetch API keys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name } = await req.json()

    // 1. Check for API key limit (e.g., 5 keys per user)
    const MAX_KEYS = 5;
    const existingKeysCount = await prisma.apiKey.count({
      where: {
        userId: user.id,
        revokedAt: null,
      }
    });

    if (existingKeysCount >= MAX_KEYS) {
      return NextResponse.json(
        { error: `API key limit reached. You can only have a maximum of ${MAX_KEYS} active keys.` },
        { status: 403 }
      )
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "API key name is required" },
        { status: 400 }
      )
    }

    // Generate a secure random API key
    const rawKey = `vx_${crypto.randomBytes(32).toString("hex")}`
    const keyHash = hashApiKey(rawKey);

    const apiKey = await (prisma.apiKey as any).create({
      data: {
        userId: user.id,
        name: name.trim(),
        key: rawKey,      // kept for backward compat — remove after full migration
        keyHash,          // primary lookup field going forward
        sponsorshipPolicy: "DEVELOPER_SPONSORS",
        markupPercentage: 10,
        maxSponsoredTxsPerUser: 5,
        monthlyLimitUsd: 100.0,
      },
      select: {
        id: true,
        name: true,
        key: true,        // returned once here — never again after this response
        sponsorshipPolicy: true,
        markupPercentage: true,
        maxSponsoredTxsPerUser: true,
        monthlyLimitUsd: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ apiKey })
  } catch (error: any) {
    console.error("Dashboard API: Failed to create API key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
