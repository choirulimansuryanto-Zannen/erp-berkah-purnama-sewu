// Pure — no imports — so it's directly unit-testable without pulling in
// Prisma. Excludes visually-ambiguous characters (0/O, 1/I) since this code
// is meant to be read off a receipt or typed in by a cashier.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateMemberCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `M-${suffix}`;
}
