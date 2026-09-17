import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = fileURLToPath(new URL("../src/session-controls.css", import.meta.url));
const css = readFileSync(cssPath, "utf8");

describe("session controls responsive contract", () => {
  it("keeps the logout action non-shrinking while account copy may truncate", () => {
    expect(css).toContain(".session-chip {");
    expect(css).toContain("flex: 1 1 auto;");
    expect(css).toContain("overflow: hidden;");
    expect(css).toContain(".session-action {");
    expect(css).toContain("flex: 0 0 auto;");
    expect(css).toContain("white-space: nowrap;");
  });

  it("reserves constrained header width before the mobile single-column breakpoint", () => {
    expect(css).toContain("@media (max-width: 1050px)");
    expect(css).toContain("width: min(360px, 44vw);");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("width: 100%;");
  });
});
