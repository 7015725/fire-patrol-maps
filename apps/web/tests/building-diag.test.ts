import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { App } from "../src/App";

describe("diagnose: /:campusSlug/:segmentSlug building page", () => {
  it("renders the layout shell for the building URL", async () => {
    window.history.pushState({}, "", "/campus-mue93c9ebwnj/building-mue946szv7rr");
    render(createElement(App));
    await waitFor(
      () => {
        expect(document.querySelector(".shell"), "shell never rendered").toBeTruthy();
      },
      { timeout: 4000 },
    );
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  }, 10000);
});
