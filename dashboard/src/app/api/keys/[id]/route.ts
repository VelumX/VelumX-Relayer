import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

const ALLOWED_POLICIES = new Set(['USER_PAYS', 'DEVELOPER_SPONSORS']);

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const apiKey = await (prisma.apiKey as any).findUnique({
      where: { id },
      select: { id: true, userId: true }
    })

    if (!apiKey || apiKey.userId !== user.id) {
      // Constant-time response — don't reveal whether the key exists
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await (prisma.apiKey as any).update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to revoke API key:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const apiKey = await (prisma.apiKey as any).findUnique({
      where: { id },
      select: { id: true, userId: true }
    })

    if (!apiKey || apiKey.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ── Strict input validation — only allow known fields with safe types/ranges ──
    const update: Record<string, any> = {};

    if (body.sponsorshipPolicy !== undefined) {
      if (!ALLOWED_POLICIES.has(body.sponsorshipPolicy)) {
        return NextResponse.json({ error: "Invalid sponsorshipPolicy" }, { status: 400 })
      }
      update.sponsorshipPolicy = body.sponsorshipPolicy;
    }

    if (body.markupPercentage !== undefined) {
      const val = parseInt(body.markupPercentage, 10);
      if (isNaN(val) || val < 0 || val > 1000) {
        return NextResponse.json({ error: "markupPercentage must be 0–1000" }, { status: 400 })
      }
      update.markupPercentage = val;
    }

    if (body.maxSponsoredTxsPerUser !== undefined) {
      const val = parseInt(body.maxSponsoredTxsPerUser, 10);
      if (isNaN(val) || val < 0 || val > 100000) {
        return NextResponse.json({ error: "maxSponsoredTxsPerUser must be 0–100000" }, { status: 400 })
      }
      update.maxSponsoredTxsPerUser = val;
    }

    if (body.monthlyLimitUsd !== undefined) {
      const val = parseFloat(body.monthlyLimitUsd);
      if (isNaN(val) || val < 0 || val > 1000000) {
        return NextResponse.json({ error: "monthlyLimitUsd must be 0–1000000" }, { status: 400 })
      }
      update.monthlyLimitUsd = val;
    }

    if (body.supportedGasTokens !== undefined) {
      if (!Array.isArray(body.supportedGasTokens) || body.supportedGasTokens.length > 20 ||
          body.supportedGasTokens.some((t: any) => typeof t !== 'string' || t.length > 128)) {
        return NextResponse.json({ error: "Invalid supportedGasTokens" }, { status: 400 })
      }
      update.supportedGasTokens = body.supportedGasTokens;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const updatedKey = await (prisma.apiKey as any).update({
      where: { id },
      data: update,
    })

    return NextResponse.json(updatedKey)
  } catch (error) {
    console.error("Failed to update API key:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
