import { generateMemberCode } from "@/lib/member-code";

describe("generateMemberCode", () => {
  it("matches the M-XXXXXX format using only unambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateMemberCode()).toMatch(/^M-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("excludes visually-ambiguous characters (0/O, 1/I)", () => {
    const code = generateMemberCode();
    expect(code).not.toMatch(/[01OI]/);
  });

  it("is not deterministic across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateMemberCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
