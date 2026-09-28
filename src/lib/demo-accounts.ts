import type { Role } from "@prisma/client";

// Seed accounts created by prisma/seed.ts — dev/demo use only.
export const DEMO_PASSWORD = "ChangeMe123!";

export const DEMO_USERS: { email: string; name: string; role: Role; outlet?: "cilegon-01" }[] = [
  { email: "pramuniaga.cilegon@berkahpurnamasewu.test", name: "Pramuniaga Cilegon", role: "PRAMUNIAGA", outlet: "cilegon-01" },
  { email: "spv.cilegon@berkahpurnamasewu.test", name: "SPV Cilegon", role: "SPV" },
  { email: "office@berkahpurnamasewu.test", name: "Office HQ", role: "OFFICE" },
  { email: "ops.admin@berkahpurnamasewu.test", name: "Ops Admin Demo", role: "OPS_ADMIN" },
  { email: "fa.admin@berkahpurnamasewu.test", name: "FA Admin Demo", role: "FA_ADMIN" },
  { email: "hrga.admin@berkahpurnamasewu.test", name: "HRGA Admin Demo", role: "HRGA_ADMIN" },
  { email: "marketing.admin@berkahpurnamasewu.test", name: "Marketing Admin Demo", role: "MARKETING_ADMIN" },
  { email: "admin@berkahpurnamasewu.test", name: "Master Admin", role: "MASTER_ADMIN" },
];
