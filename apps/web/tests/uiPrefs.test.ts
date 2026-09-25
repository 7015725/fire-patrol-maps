import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_UI_PREFS,
  UI_PREFS_KEY,
  applyUiPrefs,
  loadUiPrefs,
  saveUiPrefs,
} from "../src/lib/uiPrefs";

describe("uiPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
  });

  it("returns defaults when nothing stored", () => {
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS);
    expect(DEFAULT_UI_PREFS).toEqual({
      hamburgerNav: false,
      stackFormsMobile: false,
    });
  });

  it("roundtrips through localStorage", () => {
    saveUiPrefs({ hamburgerNav: true, stackFormsMobile: true });
    expect(loadUiPrefs()).toEqual({ hamburgerNav: true, stackFormsMobile: true });
    saveUiPrefs({ hamburgerNav: false, stackFormsMobile: false });
    expect(loadUiPrefs()).toEqual({ hamburgerNav: false, stackFormsMobile: false });
  });

  it("ignores corrupted or partial stored JSON", () => {
    localStorage.setItem(UI_PREFS_KEY, "{oops");
    expect(loadUiPrefs()).toEqual(DEFAULT_UI_PREFS);
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ hamburgerNav: true }));
    expect(loadUiPrefs()).toEqual({ hamburgerNav: true, stackFormsMobile: false });
  });

  it("maps prefs to body classes both ways", () => {
    applyUiPrefs({ hamburgerNav: true, stackFormsMobile: true });
    expect(document.body.classList.contains("pref-hamburger")).toBe(true);
    expect(document.body.classList.contains("pref-stack-forms")).toBe(true);

    applyUiPrefs(DEFAULT_UI_PREFS);
    expect(document.body.classList.contains("pref-hamburger")).toBe(false);
    expect(document.body.classList.contains("pref-stack-forms")).toBe(false);
  });

  it("saveUiPrefs applies body classes immediately", () => {
    saveUiPrefs({ hamburgerNav: true, stackFormsMobile: false });
    expect(document.body.classList.contains("pref-hamburger")).toBe(true);
    expect(document.body.classList.contains("pref-stack-forms")).toBe(false);
  });
});
