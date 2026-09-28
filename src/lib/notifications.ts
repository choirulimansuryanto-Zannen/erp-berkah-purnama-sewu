import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getBusinessSettings } from "@/lib/business-settings";

export type NotificationItem = {
  label: string;
  count: number;
  href: string;
};

export async function getNotifications(role: Role): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];

  const [pendingReports, pendingExpenses, pendingAdjustments, pendingLeaves] = await Promise.all([
    can(role, "report:validate") ? prisma.dailyReport.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    can(role, "expense:approve") ? prisma.expenseRecord.count({ where: { approvalStatus: "PENDING" } }) : Promise.resolve(0),
    can(role, "inventory:approve_adjustment")
      ? prisma.stockAdjustment.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    can(role, "attendance:approve_leave")
      ? prisma.leavePermission.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  if (pendingReports > 0) items.push({ label: "Daily Reports menunggu validasi", count: pendingReports, href: "/validations" });
  if (pendingExpenses > 0) items.push({ label: "Expenses menunggu approval", count: pendingExpenses, href: "/validations" });
  if (pendingAdjustments > 0) items.push({ label: "Stock adjustment menunggu approval", count: pendingAdjustments, href: "/validations" });
  if (pendingLeaves > 0) items.push({ label: "Permintaan cuti menunggu approval", count: pendingLeaves, href: "/validations" });

  if (can(role, "warehouse:manage")) {
    const settings = await getBusinessSettings();
    const expiryCutoff = new Date();
    expiryCutoff.setDate(expiryCutoff.getDate() + settings.expiryWarningDays);

    const [stocks, expiringLots] = await Promise.all([
      prisma.warehouseStock.findMany({ where: { minLevel: { gt: 0 } } }),
      prisma.warehouseReceiving.count({ where: { expiryDate: { lte: expiryCutoff } } }),
    ]);
    const reorderCount = stocks.filter((s) => s.qtyOnHand < s.minLevel).length;

    if (reorderCount > 0) items.push({ label: "Produk di bawah minimum stok", count: reorderCount, href: "/warehouse" });
    if (expiringLots > 0) items.push({ label: "Lot mendekati kedaluwarsa", count: expiringLots, href: "/warehouse" });
  }

  return items;
}
