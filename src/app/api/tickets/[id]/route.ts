/**
 * src/app/api/tickets/[id]/route.ts
 * GET    /api/tickets/[id]  — get ticket detail with comments
 * PATCH  /api/tickets/[id]  — update status, priority, assignee
 * DELETE /api/tickets/[id]  — delete ticket (Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const ticket = await prisma.ticket.findUnique({
            where: { id: params.id },
            include: {
                createdBy: { select: { id: true, name: true, email: true, department: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                comments: {
                    include: { author: { select: { id: true, name: true, role: true } } },
                    orderBy: { createdAt: "asc" },
                    // Employees cannot see internal (agent-only) comments
                    where: user.role === "EMPLOYEE" ? { isInternal: false } : {},
                },
            },
        });

        if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

        // Employees can only view their own tickets
        if (user.role === "EMPLOYEE" && ticket.createdById !== user.userId) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        return NextResponse.json({ ticket });
    } catch (error) {
        console.error("[GET /api/tickets/[id]]", error);
        return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (user.role === "EMPLOYEE") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

        const body = await request.json();
        const { status, priority, assignedToId } = body;

        const existing = await prisma.ticket.findUnique({ where: { id: params.id } });
        if (!existing) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

        // If resolving, set resolvedAt timestamp
        const resolvedAt =
            status === "RESOLVED" && existing.status !== "RESOLVED"
                ? new Date()
                : existing.resolvedAt;

        const ticket = await prisma.ticket.update({
            where: { id: params.id },
            data: {
                ...(status ? { status } : {}),
                ...(priority ? { priority } : {}),
                ...(assignedToId !== undefined ? { assignedToId } : {}),
                resolvedAt,
            },
        });

        // ── Notifications ──────────────────────────────────────────────────────
        const notifyUserIds: string[] = [];

        // Notify ticket creator about status changes
        if (status && status !== existing.status) {
            notifyUserIds.push(existing.createdById);
        }

        // Notify newly assigned agent
        if (assignedToId && assignedToId !== existing.assignedToId) {
            notifyUserIds.push(assignedToId);
        }

        if (notifyUserIds.length > 0) {
            const messages: Record<string, string> = {
                status: `Ticket "${existing.title}" status changed to ${status}.`,
                assign: `Ticket "${existing.title}" has been assigned to you.`,
            };

            await createNotifications(
                notifyUserIds,
                {
                    message: status ? messages.status : messages.assign,
                    ticketId: ticket.id,
                }
            );
        }

        return NextResponse.json({ ticket });
    } catch (error) {
        console.error("[PATCH /api/tickets/[id]]", error);
        return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser();
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        await prisma.ticket.delete({ where: { id: params.id } });
        return NextResponse.json({ message: "Ticket deleted." });
    } catch (error) {
        console.error("[DELETE /api/tickets/[id]]", error);
        return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
}
