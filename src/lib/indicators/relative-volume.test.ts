import { describe, expect, it } from "vitest";
import { relativeVolumeSeries } from "./relative-volume";

describe("relativeVolumeSeries", () => {
  it("compares the current session with prior sessions without leaking the current volume into its baseline", () => {
    const volumes = [...Array.from({ length: 20 }, () => 100), 200];
    const latest = relativeVolumeSeries(volumes).at(-1)!;
    expect(latest.averageVolume).toBe(100);
    expect(latest.relativeVolume).toBe(2);
  });

  it("does not publish a ratio with too few comparable sessions", () => {
    expect(relativeVolumeSeries([100, 200]).at(-1)!.relativeVolume).toBeNull();
  });
});
