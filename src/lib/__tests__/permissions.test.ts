import { can, assertCan } from "@/lib/permissions";

describe("can", () => {
  it("allows PRAMUNIAGA to ring up POS transactions", () => {
    expect(can("PRAMUNIAGA", "pos:ring_up")).toBe(true);
  });

  it("does not allow PRAMUNIAGA to validate reports", () => {
    expect(can("PRAMUNIAGA", "report:validate")).toBe(false);
  });

  it("allows MASTER_ADMIN to manage users", () => {
    expect(can("MASTER_ADMIN", "admin:manage_users")).toBe(true);
  });

  it("does not allow SPV to manage users (reconstructed matrix: HRGA_ADMIN + MASTER_ADMIN only)", () => {
    expect(can("SPV", "admin:manage_users")).toBe(false);
  });

  it("scopes the new division modules to their own role plus MASTER_ADMIN", () => {
    expect(can("MARKETING_ADMIN", "marketing:manage_campaigns")).toBe(true);
    expect(can("OPS_ADMIN", "marketing:manage_campaigns")).toBe(false);

    expect(can("HRGA_ADMIN", "hrga:manage_policy")).toBe(true);
    expect(can("SPV", "hrga:manage_policy")).toBe(false);

    expect(can("OPS_ADMIN", "warehouse:manage")).toBe(true);
    expect(can("PRAMUNIAGA", "warehouse:manage")).toBe(false);

    expect(can("MASTER_ADMIN", "marketing:manage_campaigns")).toBe(true);
    expect(can("MASTER_ADMIN", "hrga:manage_policy")).toBe(true);
    expect(can("MASTER_ADMIN", "warehouse:manage")).toBe(true);
  });

  it("gives OFFICE the same approval/dashboard powers as SPV, but company-wide (scoping is applied at query time, not here)", () => {
    expect(can("OFFICE", "report:validate")).toBe(true);
    expect(can("OFFICE", "expense:approve")).toBe(true);
    expect(can("OFFICE", "inventory:approve_adjustment")).toBe(true);
    expect(can("OFFICE", "attendance:approve_leave")).toBe(true);
    expect(can("OFFICE", "executive:view_dashboard")).toBe(true);
    // Office is not an outlet-level data-entry role and not a system admin.
    expect(can("OFFICE", "pos:ring_up")).toBe(false);
    expect(can("OFFICE", "report:submit_daily")).toBe(false);
    expect(can("OFFICE", "admin:system_config")).toBe(false);
  });

  it("lets SPV and OFFICE view the transaction history breakdowns", () => {
    expect(can("SPV", "transactions:view_history")).toBe(true);
    expect(can("OFFICE", "transactions:view_history")).toBe(true);
    expect(can("PRAMUNIAGA", "transactions:view_history")).toBe(true);
    expect(can("OPS_ADMIN", "transactions:view_history")).toBe(false);
  });
});

describe("assertCan", () => {
  it("throws when the role lacks the permission", () => {
    expect(() => assertCan("PRAMUNIAGA", "admin:system_config")).toThrow();
  });

  it("does not throw when the role has the permission", () => {
    expect(() => assertCan("MASTER_ADMIN", "admin:system_config")).not.toThrow();
  });
});
