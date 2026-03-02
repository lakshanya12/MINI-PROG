/**
 * src/app/api/tickets/route.ts
 * GET  /api/tickets  — list tickets (scoped by role)
 * POST /api/tickets  — create a new ticket
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateSLADeadline } from "@/lib/sla";
import { createNotification } from "@/lib/notifications";

// ─── GET: List tickets ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const user = getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") as string | undefined;
        const priority = searchParams.get("priority") as string | undefined;
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit = 20; // tickets per page

        // ── Role-based filtering ──────────────────────────────────────────────
        // Employees only see their own tickets; Agents see assigned; Admins see all
        const roleFilter =
            user.role === "EMPLOYEE"
                ? { createdById: user.userId }
                : user.role === "AGENT"
                    ? { assignedToId: user.userId }
                    : {}; // ADMIN sees all

        const where = {
            ...roleFilter,
            ...(status ? { status: status as any } : {}),
            ...(priority ? { priority: priority as any } : {}),
        };

        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                include: {
                    createdBy: { select: { id: true, name: true, email: true } },
                    assignedTo: { select: { id: true, name: true, email: true } },
                    _count: { select: { comments: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.ticket.count({ where }),
        ]);

        return NextResponse.json({ tickets, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error("[GET /api/tickets]", error);
        return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
}

// ─── POST: Create ticket ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const user = getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { title, description, priority, category } = await request.json();

        if (!title || !description || !priority || !category) {
            return NextResponse.json({ error: "All fields are required." }, { status: 400 });
        }

        // Calculate SLA deadline based on priority
        const slaDeadline = calculateSLADeadline(priority);

        const ticket = await prisma.ticket.create({
            data: {
                title,
                description,
                priority,
                category,
                slaDeadline,
                createdById: user.userId,
            },
        });

        // Notify all admins about the new ticket
        const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
        await Promise.all(
            admins.map((admin) =>
                createNotification({
                    userId: admin.id,
                    message: `New ticket: "${title}" was submitted by ${user.name}.`,
                    ticketId: ticket.id,
                })
            )
        );

        return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/tickets]", error);
        return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
}
