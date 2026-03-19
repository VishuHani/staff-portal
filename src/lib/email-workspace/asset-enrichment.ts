import sharp from "sharp";

export type EmailAssetKind = "IMAGE" | "GIF" | "VIDEO" | "FILE";

export interface ExtractAssetEnrichmentInput {
  fileName: string;
  mimeType: string;
  kind: EmailAssetKind;
  bytes: Uint8Array;
  tags?: string[];
  storagePath?: string;
}

export interface ExtractAssetEnrichmentResult {
  width: number | null;
  height: number | null;
  durationSec: number | null;
  thumbnailBuffer: Buffer | null;
  thumbnailContentType: "image/webp" | "image/png" | null;
  thumbnailExtension: "webp" | "png" | null;
  thumbnailMode: "image_resize" | "placeholder" | "none";
  metadataJson: Record<string, unknown>;
  indexTags: string[];
}

type Mp4Box = {
  type: string;
  offset: number;
  size: number;
  headerSize: number;
};

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 320;

function normalizeTag(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9:_./+-]+/g, "-");
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 80);
}

function addTag(tags: Set<string>, value: string) {
  const normalized = normalizeTag(value);
  if (normalized) {
    tags.add(normalized);
  }
}

export function extractFileExtension(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }

  const withoutQuery = cleaned.split("?")[0]?.split("#")[0] || cleaned;
  const segments = withoutQuery.split("/");
  const filename = segments[segments.length - 1] || withoutQuery;
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return null;
  }

  return filename.slice(dotIndex + 1).toLowerCase();
}

function classifyImageSize(width: number, height: number): "small" | "medium" | "large" {
  const pixels = width * height;
  if (pixels >= 1920 * 1080) {
    return "large";
  }
  if (pixels >= 800 * 600) {
    return "medium";
  }
  return "small";
}

function classifyDuration(seconds: number): "short" | "medium" | "long" {
  if (seconds < 30) {
    return "short";
  }
  if (seconds < 180) {
    return "medium";
  }
  return "long";
}

function getImageOrientation(width: number, height: number): "landscape" | "portrait" | "square" {
  if (width === height) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}

export function buildAssetIndexTags(input: {
  providedTags?: string[];
  mimeType: string;
  kind: EmailAssetKind;
  name: string;
  extension?: string | null;
  storagePath?: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
}): string[] {
  const tags = new Set<string>();
  for (const tag of input.providedTags || []) {
    addTag(tags, tag);
  }

  addTag(tags, input.kind.toLowerCase());
  addTag(tags, `kind:${input.kind.toLowerCase()}`);
  addTag(tags, input.mimeType.toLowerCase());

  const mimeMajor = input.mimeType.split("/")[0]?.toLowerCase();
  if (mimeMajor) {
    addTag(tags, `type:${mimeMajor}`);
  }

  if (input.extension) {
    addTag(tags, `ext:${input.extension}`);
  }

  if (input.storagePath) {
    const storageExt = extractFileExtension(input.storagePath);
    if (storageExt) {
      addTag(tags, `ext:${storageExt}`);
    }
  }

  const nameExt = extractFileExtension(input.name);
  if (nameExt) {
    addTag(tags, `ext:${nameExt}`);
  }

  if (input.width && input.height) {
    addTag(tags, `w:${input.width}`);
    addTag(tags, `h:${input.height}`);
    addTag(tags, `dim:${input.width}x${input.height}`);
    addTag(tags, `orientation:${getImageOrientation(input.width, input.height)}`);
    addTag(tags, `size:${classifyImageSize(input.width, input.height)}`);
  }

  if (input.durationSec && input.durationSec > 0) {
    addTag(tags, `duration:${input.durationSec}`);
    addTag(tags, `duration:${classifyDuration(input.durationSec)}`);
  }

  return [...tags];
}

function readMp4Box(buffer: Buffer, offset: number, maxOffset: number): Mp4Box | null {
  if (offset + 8 > maxOffset || offset + 8 > buffer.length) {
    return null;
  }

  const smallSize = buffer.readUInt32BE(offset);
  const type = buffer.toString("ascii", offset + 4, offset + 8);
  let size = smallSize;
  let headerSize = 8;

  if (smallSize === 1) {
    if (offset + 16 > maxOffset || offset + 16 > buffer.length) {
      return null;
    }
    const largeSize = Number(buffer.readBigUInt64BE(offset + 8));
    if (!Number.isFinite(largeSize) || largeSize < 16) {
      return null;
    }
    size = largeSize;
    headerSize = 16;
  } else if (smallSize === 0) {
    size = maxOffset - offset;
  }

  if (size < headerSize || offset + size > maxOffset || offset + size > buffer.length) {
    return null;
  }

  return {
    type,
    offset,
    size,
    headerSize,
  };
}

function findMp4Box(buffer: Buffer, start: number, end: number, targetType: string): Mp4Box | null {
  let cursor = start;
  while (cursor + 8 <= end) {
    const box = readMp4Box(buffer, cursor, end);
    if (!box) {
      break;
    }

    if (box.type === targetType) {
      return box;
    }

    if (box.size <= 0) {
      break;
    }
    cursor += box.size;
  }

  return null;
}

export function extractMp4DurationSeconds(buffer: Buffer): number | null {
  const moov = findMp4Box(buffer, 0, buffer.length, "moov");
  if (!moov) {
    return null;
  }

  const contentStart = moov.offset + moov.headerSize;
  const contentEnd = moov.offset + moov.size;
  const mvhd = findMp4Box(buffer, contentStart, contentEnd, "mvhd");
  if (!mvhd) {
    return null;
  }

  const payloadStart = mvhd.offset + mvhd.headerSize;
  if (payloadStart + 20 > buffer.length) {
    return null;
  }

  const version = buffer.readUInt8(payloadStart);
  let timescaleOffset: number;
  let durationOffset: number;
  let duration: number;

  if (version === 1) {
    timescaleOffset = payloadStart + 20;
    durationOffset = payloadStart + 24;
    if (durationOffset + 8 > buffer.length) {
      return null;
    }
    duration = Number(buffer.readBigUInt64BE(durationOffset));
  } else {
    timescaleOffset = payloadStart + 12;
    durationOffset = payloadStart + 16;
    if (durationOffset + 4 > buffer.length) {
      return null;
    }
    duration = buffer.readUInt32BE(durationOffset);
  }

  if (timescaleOffset + 4 > buffer.length) {
    return null;
  }

  const timescale = buffer.readUInt32BE(timescaleOffset);
  if (!timescale || duration < 0) {
    return null;
  }

  const seconds = duration / timescale;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.max(1, Math.round(seconds));
}

function buildPlaceholderSvg(input: { kind: EmailAssetKind; extension: string | null; fileName: string }) {
  const title = input.fileName.slice(0, 40).replace(/[<>&"]/g, "");
  const subtitle = input.extension ? input.extension.toUpperCase() : input.kind;
  const kindLabel = input.kind === "GIF" ? "GIF" : input.kind;

  return `<svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" fill="url(#bg)" />
  <rect x="24" y="24" width="${THUMBNAIL_WIDTH - 48}" height="${THUMBNAIL_HEIGHT - 48}" rx="12" fill="#111827" stroke="#475569" />
  <text x="50%" y="44%" text-anchor="middle" fill="#e2e8f0" font-size="30" font-family="Arial, sans-serif" font-weight="700">${kindLabel}</text>
  <text x="50%" y="59%" text-anchor="middle" fill="#cbd5e1" font-size="18" font-family="Arial, sans-serif">${subtitle}</text>
  <text x="50%" y="74%" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Arial, sans-serif">${title}</text>
</svg>`;
}

async function buildThumbnail(input: {
  kind: EmailAssetKind;
  mimeType: string;
  fileName: string;
  bytes: Buffer;
}): Promise<{
  buffer: Buffer | null;
  contentType: "image/webp" | "image/png" | null;
  extension: "webp" | "png" | null;
  mode: "image_resize" | "placeholder" | "none";
}> {
  if (input.mimeType.startsWith("image/")) {
    try {
      const resized = await sharp(input.bytes, { animated: input.mimeType === "image/gif" })
        .resize({
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      return {
        buffer: resized,
        contentType: "image/webp",
        extension: "webp",
        mode: "image_resize",
      };
    } catch {
      // fall through to placeholder thumbnail
    }
  }

  try {
    const extension = extractFileExtension(input.fileName);
    const svg = buildPlaceholderSvg({
      kind: input.kind,
      extension,
      fileName: input.fileName,
    });
    const placeholder = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
    return {
      buffer: placeholder,
      contentType: "image/png",
      extension: "png",
      mode: "placeholder",
    };
  } catch {
    return {
      buffer: null,
      contentType: null,
      extension: null,
      mode: "none",
    };
  }
}

export async function extractAssetEnrichment(
  input: ExtractAssetEnrichmentInput
): Promise<ExtractAssetEnrichmentResult> {
  const bytes = Buffer.from(input.bytes);
  const extension = extractFileExtension(input.fileName) || extractFileExtension(input.storagePath || "");

  let width: number | null = null;
  let height: number | null = null;
  if (input.mimeType.startsWith("image/")) {
    try {
      const metadata = await sharp(bytes, { animated: input.mimeType === "image/gif" }).metadata();
      width = typeof metadata.width === "number" ? metadata.width : null;
      height = typeof metadata.height === "number" ? metadata.height : null;
    } catch {
      width = null;
      height = null;
    }
  }

  let durationSec: number | null = null;
  if (input.kind === "VIDEO" || input.mimeType.startsWith("video/")) {
    const ext = extension || "";
    if (ext === "mp4" || ext === "m4v" || ext === "mov") {
      durationSec = extractMp4DurationSeconds(bytes);
    }
  }

  const thumbnail = await buildThumbnail({
    kind: input.kind,
    mimeType: input.mimeType,
    fileName: input.fileName,
    bytes,
  });

  const indexTags = buildAssetIndexTags({
    providedTags: input.tags || [],
    mimeType: input.mimeType,
    kind: input.kind,
    name: input.fileName,
    extension,
    storagePath: input.storagePath,
    width,
    height,
    durationSec,
  });

  return {
    width,
    height,
    durationSec,
    thumbnailBuffer: thumbnail.buffer,
    thumbnailContentType: thumbnail.contentType,
    thumbnailExtension: thumbnail.extension,
    thumbnailMode: thumbnail.mode,
    metadataJson: {
      extension,
      image:
        width && height
          ? {
              width,
              height,
              orientation: getImageOrientation(width, height),
              sizeClass: classifyImageSize(width, height),
            }
          : null,
      video: durationSec ? { durationSec, durationClass: classifyDuration(durationSec) } : null,
      thumbnail: {
        mode: thumbnail.mode,
      },
      indexedAt: new Date().toISOString(),
    },
    indexTags,
  };
}
