import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params;

    // 1. Verify ownership before deleting
    const adapter = await (prisma.adapter as any).findUnique({
      where: { id }
    });

    if (!adapter) {
      return NextResponse.json({ error: "Adapter not found" }, { status: 404 })
    }

    if (adapter.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await (prisma.adapter as any).delete({
      where: { id }
    });

    return NextResponse.json({ message: "Adapter revoked successfully" })
  } catch (error: any) {
    console.error("Dashboard API (Adapters): Failed to delete adapter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
