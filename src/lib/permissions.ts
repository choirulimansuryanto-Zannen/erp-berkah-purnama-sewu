import type { Role } from "@prisma/client";

/**
 * RBAC matrix reconstructed from prd.md module descriptions — the source
 * PRD's permission-matrix table was corrupted (mojibake) and unreadable.
 * PENDING STAKEHOLDER CONFIRMATION. See prd.md "Detailed Permission Matrix"
 * note before relying on this for anything beyond development.
 *
 * OFFICE is a Sales-division HQ role added 2026-08-07 per stakeholder
 * request: sits above SPV, aggregates all SPVs' regions company-wide
 * (validations, dashboard, report summary, stock summary) but does not
 * do outlet-level data entry (no POS/report-submit/expense-submit) and
 * is not a system administrator.
 */
export const PERMISSIONS = {
  "attendance:checkin_own": ["PRAMUNIAGA", "SPV", "OFFICE", "OPS_ADMIN", "FA_ADMIN", "HRGA_ADMIN", "MARKETING_ADMIN", "MASTER_ADMIN"],
  "attendance:view_team": ["SPV", "OFFICE", "HRGA_ADMIN", "MASTER_ADMIN"],
  "attendance:approve_leave": ["SPV", "OFFICE", "HRGA_ADMIN", "MASTER_ADMIN"],
  "checklist:submit": ["PRAMUNIAGA"],

  "pos:ring_up": ["PRAMUNIAGA"],
  // Anyone who can see a transaction (transactions:view_history) can also
  // request a void/edit on it — the void endpoint itself still requires
  // approvalSpvId to resolve to an SPV/MASTER_ADMIN, so that's the actual
  // control; this just decides who can *initiate* the request.
  "pos:void_transaction": ["PRAMUNIAGA", "SPV", "OFFICE", "FA_ADMIN", "MASTER_ADMIN"],

  "transactions:view_history": ["PRAMUNIAGA", "SPV", "OFFICE", "FA_ADMIN", "MASTER_ADMIN"],

  "report:submit_daily": ["PRAMUNIAGA"],
  "report:validate": ["SPV", "OFFICE", "FA_ADMIN", "MASTER_ADMIN"],
  "report:view_company_wide": ["OFFICE", "FA_ADMIN", "MASTER_ADMIN"],

  // Dashboard/report/stock summary access, scoped at query time: SPV sees
  // only their own region (src/lib/outlet-scope.ts), everyone else here
  // sees company-wide.
  "executive:view_dashboard": ["SPV", "OFFICE", "FA_ADMIN", "MASTER_ADMIN"],
  "inventory:view_summary": ["SPV", "OFFICE", "OPS_ADMIN", "MASTER_ADMIN"],

  "inventory:record_check": ["PRAMUNIAGA", "OPS_ADMIN"],
  "inventory:approve_adjustment": ["SPV", "OFFICE", "OPS_ADMIN", "MASTER_ADMIN"],

  "expense:submit": ["PRAMUNIAGA"],
  "expense:approve": ["SPV", "OFFICE", "FA_ADMIN", "MASTER_ADMIN"],
  "finance:view_ledger": ["FA_ADMIN", "MASTER_ADMIN"],

  "member:register": ["PRAMUNIAGA", "MARKETING_ADMIN", "MASTER_ADMIN"],
  "member:view": ["PRAMUNIAGA", "SPV", "OFFICE", "MARKETING_ADMIN", "MASTER_ADMIN"],
  "marketing:manage_campaigns": ["MARKETING_ADMIN", "MASTER_ADMIN"],

  "hrga:manage_policy": ["HRGA_ADMIN", "MASTER_ADMIN"],
  "hrga:view_compliance": ["HRGA_ADMIN", "MASTER_ADMIN"],

  "warehouse:manage": ["OPS_ADMIN", "MASTER_ADMIN"],

  "admin:manage_users": ["HRGA_ADMIN", "MASTER_ADMIN"],
  "admin:system_config": ["MASTER_ADMIN"],
  "admin:audit_trail": ["MASTER_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Role ${role} lacks permission ${permission}`);
  }
}
