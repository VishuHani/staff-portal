import { describe, expect, it } from "vitest";
import {
  buildAssetIndexTags,
  extractMp4DurationSeconds,
} from "@/lib/email-workspace/asset-enrichment";

function buildMp4WithDuration(duration: number, timescale: number): Buffer {
  const mvhdPayload = Buffer.alloc(20);
  mvhdPayload.writeUInt8(0, 0); // version 0
  mvhdPayload.writeUInt32BE(timescale, 12);
  mvhdPayload.writeUInt32BE(duration, 16);

  const mvhdSize = 8 + mvhdPayload.length;
  const mvhdBox = Buffer.alloc(mvhdSize);
  mvhdBox.writeUInt32BE(mvhdSize, 0);
  mvhdBox.write("mvhd", 4, "ascii");
  mvhdPayload.copy(mvhdBox, 8);

  const moovSize = 8 + mvhdBox.length;
  const moovBox = Buffer.alloc(moovSize);
  moovBox.writeUInt32BE(moovSize, 0);
  moovBox.write("moov", 4, "ascii");
  mvhdBox.copy(moovBox, 8);

  return moovBox;
}

describe("Asset Enrichment Helpers", () => {
  it("extracts MP4 duration from mvhd timescale/duration", () => {
    const buffer = buildMp4WithDuration(45_000, 1_000);
    expect(extractMp4DurationSeconds(buffer)).toBe(45);
  });

  it("returns null for invalid mp4 payloads", () => {
    expect(extractMp4DurationSeconds(Buffer.from("not-a-real-mp4"))).toBeNull();
  });

  it("builds metadata index tags for dimensions, duration, kind and extension", () => {
    const tags = buildAssetIndexTags({
      providedTags: ["Hero", " Banner "],
      mimeType: "video/mp4",
      kind: "VIDEO",
      name: "launch-video.mp4",
      storagePath: "uploaded/u1/123-launch-video.mp4",
      width: 1920,
      height: 1080,
      durationSec: 95,
    });

    expect(tags).toContain("hero");
    expect(tags).toContain("banner");
    expect(tags).toContain("kind:video");
    expect(tags).toContain("ext:mp4");
    expect(tags).toContain("dim:1920x1080");
    expect(tags).toContain("orientation:landscape");
    expect(tags).toContain("duration:medium");
  });
});
