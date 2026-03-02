/**
 * src/app/api/tickets/[id]/comments/route.ts
 * GET  /api/tickets/[id]/comments — list comments
 * POST /api/tickets/[id]/comments — add a comment
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const user = getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const comments = await prisma.comment.findMany({
        where: {
            ticketId: params.id,
            // Employees cannot see internal comments
            isInternal: user.role === "EMPLOYEE" ? false : undefined,
        },
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { content, isInternal } = await request.json();
        if (!content?.trim()) {
            return NextResponse.json({ error: "Comment content is required." }, { status: 400 });
        }

        // Only agents/admins can post internal comments
        const internal = (user.role !== "EMPLOYEE") && !!isInternal;

        const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
        if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

        const comment = await prisma.comment.create({
            data: {
                content,
                isInternal: internal,
                ticketId: params.id,
                authorId: user.userId,
            },
            include: { author: { select: { id: true, name: true, role: true } } },
        });

        // Notify ticket creator and assignee (except the commenter)
        const notifyIds = [ticket.createdById, ticket.assignedToId]
            .filter((id): id is string => !!id && id !== user.userId);

        if (notifyIds.length > 0) {
            await createNotifications(notifyIds, {
                message: `${user.name} commented on ticket "${ticket.title}".`,
                ticketId: ticket.id,
            });
        }

        return NextResponse.json({ comment }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/tickets/[id]/comments]", error);
        return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
}
