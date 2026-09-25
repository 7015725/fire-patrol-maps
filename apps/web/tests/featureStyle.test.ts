import { describe, expect, it } from "vitest";
import { FEATURE_TYPES, type LayerPreset } from "../src/types";
import {
  FEATURE_TYPE_COLORS,
  colorForType,
  inspectionBadge,
  inspectionBadgeColor,
  presetDisplayName,
} from "../src/lib/featureStyle";

describe("featureStyle", () => {
  it("defines a color for every FEATURE_TYPES entry", () => {
    for (const type of FEATURE_TYPES) {
      expect(FEATURE_TYPE_COLORS, `missing color for ${type}`).toHaveProperty(type);
      expect(typeof FEATURE_TYPE_COLORS[type]).toBe("string");
      expect(FEATURE_TYPE_COLORS[type].length).toBeGreaterThan(0);
    }
  });

  it("falls back to slate for unknown types", () => {
    expect(colorForType("not_a_real_type")).toBe("#64748b");
  });

  it("prefers admin custom preset names, falls back to i18n then slug", () => {
    const t = (key: string, opts?: { defaultValue?: string }) =>
      key === "presets.evacuation" ? "疏散" : (opts?.defaultValue ?? key);
    const base: LayerPreset = {
      id: "1",
      slug: "evacuation",
      nameZh: null,
      nameEn: null,
      featureTypes: ["exit"],
      sortOrder: 1,
    };
    expect(presetDisplayName(base, "zh-CN", t)).toBe("疏散");
    expect(
      presetDisplayName({ ...base, nameZh: "疏散改名" }, "zh-CN", t),
    ).toBe("疏散改名");
    expect(
      presetDisplayName({ ...base, nameEn: "Evac Custom" }, "en-US", t),
    ).toBe("Evac Custom");
    // Cross-language fallback beats the slug.
    expect(
      presetDisplayName({ ...base, nameZh: "疏散改名" }, "en-US", t),
    ).toBe("疏散改名");
    // Custom slug without a name shows the slug.
    expect(
      presetDisplayName(
        { ...base, slug: "custom-abc", nameZh: null, nameEn: null },
        "zh-CN",
        t,
      ),
    ).toBe("custom-abc");
  });

  it("maps inspection marks to grey/green/red badges", () => {
    expect(inspectionBadge(null)).toBe("uninspected");
    expect(inspectionBadge(undefined)).toBe("uninspected");
    expect(inspectionBadge({ status: "ok", note: null, month: "2026-09", updatedAt: "" })).toBe("ok");
    expect(inspectionBadge({ status: "fault", note: "x", month: "2026-09", updatedAt: "" })).toBe("fault");
    expect(inspectionBadgeColor(null)).toBe("#9ca3af");
    expect(inspectionBadgeColor({ status: "ok", note: null, month: "2026-09", updatedAt: "" })).toBe("#16a34a");
    expect(inspectionBadgeColor({ status: "fault", note: "x", month: "2026-09", updatedAt: "" })).toBe("#dc2626");
  });
});
