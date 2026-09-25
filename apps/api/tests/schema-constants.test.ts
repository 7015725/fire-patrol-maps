import { describe, it, expect } from "vitest";
import { FEATURE_TYPES, PRESET_SEEDS } from "../src/lib/feature-types.js";

describe("feature type catalog", () => {
  it("includes AWAIR-oriented safety types", () => {
    expect(FEATURE_TYPES).toEqual(
      expect.arrayContaining([
        "fire_extinguisher",
        "fire_hydrant",
        "exit",
        "assembly_point",
        "safe_haven",
        "fire_alarm_pull",
        "electrical_fire_controller",
        "gas_suppression_controller",
        "water_gong",
        "aed",
        "first_aid",
        "eye_wash",
        "safety_shower",
        "spill_kit",
        "emergency_phone",
        "water_shutoff",
        "gas_shutoff",
        "electrical_panel",
        "loto_isolation",
        "roof_access",
        "hvac",
        "hazard",
        "chemical_storage",
        "flammable_storage",
        "high_pressure",
        "co_detector",
        "smoke_detector",
        "confined_space",
        "sds_station",
        "room_label",
        "elevator_lobby",
        "freight_elevator",
      ])
    );
    expect(FEATURE_TYPES).toHaveLength(32);
    // No duplicates
    expect(new Set(FEATURE_TYPES).size).toBe(FEATURE_TYPES.length);
  });

  it("defines required layer presets", () => {
    const slugs = PRESET_SEEDS.map((p) => p.slug);
    expect(slugs).toEqual([
      "all",
      "evacuation",
      "fire_response",
      "medical",
      "spill_chemical",
      "utilities",
      "hazards",
      "rooms",
    ]);
  });

  it("uses only catalog feature types in non-all presets", () => {
    const catalog = new Set<string>(FEATURE_TYPES);
    for (const p of PRESET_SEEDS) {
      if (p.featureTypes === "*") continue;
      for (const t of p.featureTypes) {
        expect(catalog.has(t), `${p.slug} references unknown type ${t}`).toBe(true);
      }
    }
  });
});
