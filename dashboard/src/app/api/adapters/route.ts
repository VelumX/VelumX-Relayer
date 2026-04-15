import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adapters = await (prisma.adapter as any).findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ adapters })
  } catch (error: any) {
    console.error("Dashboard API (Adapters): Failed to fetch adapters:", error);
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

    const { name, address, description } = await req.json()

    // 1. Basic validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Adapter name is required" }, { status: 400 })
    }

    // 2. Principal validation (Regex check as requested)
    // Stacks Principals (SP... or ST...) are typically 41 characters or slightly varied, starting with S
    const principalRegex = /^[S][PT][0-9A-Z]{39,41}(\.[a-zA-Z0-9_-]+)?$/;
    if (!principalRegex.test(address)) {
      return NextResponse.json({ error: "Invalid Stacks contract principal format (e.g., SP...contract-name)" }, { status: 400 })
    }

    // 3. Prevent duplicate addresses for the same user (address is unique in schema anyway)
    const existing = await (prisma.adapter as any).findUnique({
      where: { address }
    });

    if (existing) {
        return NextResponse.json({ error: "This adapter address is already registered." }, { status: 409 })
    }

    const adapter = await (prisma.adapter as any).create({
      data: {
        userId: user.id,
        name: name.trim(),
        address: address.trim(),
        description: description?.trim() || null,
      }
    })

    return NextResponse.json({ adapter })
  } catch (error: any) {
    console.error("Dashboard API (Adapters): Failed to create adapter:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
