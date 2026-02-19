// src/lib/sla.ts
import { Ticket } from "@/generated/prisma/client";

export function isSlaBreached(ticket: Ticket): boolean {
  const createdAt = new Date(ticket.createdAt).getTime();
  const now = Date.now();

  const slaMs = ticket.slaHours * 60 * 60 * 1000;
  return now > createdAt + slaMs && ticket.status !== "CLOSED";
}

/**
 * Returns SLA status string for UI
 */
export function getSlaStatus(ticket: Ticket): "OK" | "BREACHED" {
  return isSlaBreached(ticket) ? "BREACHED" : "OK";
}
