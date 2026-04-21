import { describe, expect, test } from "bun:test";
import {
  applySimpleSearchLimit,
  buildBinaryMetadataText,
  classifyBinaryMime,
  encodeBytesAsBase64,
  extractFileExtension,
  guessMimeType,
  isBinaryFilename,
  MAX_INLINE_BINARY_BYTES,
} from "./index";

describe("extractFileExtension", () => {
  test("returns the lowercased extension for a plain filename", () => {
    expect(extractFileExtension("notes.md")).toBe("md");
    expect(extractFileExtension("recording.MP3")).toBe("mp3");
    expect(extractFileExtension("IMAGE.PNG")).toBe("png");
  });

  test("uses the last dot when the name has multiple dots", () => {
    // `.tar.gz` archives should resolve to `gz`, not `tar` — we care
    // about the effective container format, not the inner tarball.
    expect(extractFileExtension("archive.tar.gz")).toBe("gz");
    expect(extractFileExtension("My Note v2.3.md")).toBe("md");
  });

  test("returns null for files with no extension", () => {
    expect(extractFileExtension("README")).toBeNull();
    expect(extractFileExtension("Makefile")).toBeNull();
  });

  test("returns null for hidden filenames with a leading dot only", () => {
    // `.env` is a filename, not an extension — the leading dot is
    // the conventional "hidden file" marker, not a separator.
    expect(extractFileExtension(".env")).toBeNull();
    expect(extractFileExtension(".gitignore")).toBeNull();
  });

  test("returns null for a filename ending with a trailing dot", () => {
    // `foo.` is a malformed filename with no actual extension.
    expect(extractFileExtension("foo.")).toBeNull();
  });

  test("handles nested paths by looking only at the basename's tail", () => {
    // extractFileExtension is path-agnostic: it uses lastIndexOf('.')
    // on the full string, which still lands inside the basename for
    // any realistic vault path.
    expect(extractFileExtension("Attachments/audio.mp3")).toBe("mp3");
    expect(extractFileExtension("folder/subfolder/note.md")).toBe("md");
  });
});

describe("isBinaryFilename", () => {
  test("identifies common audio extensions as binary", () => {
    expect(isBinaryFilename("recording.mp3")).toBe(true);
    expect(isBinaryFilename("voice.wav")).toBe(true);
    expect(isBinaryFilename("podcast.m4a")).toBe(true);
    expect(isBinaryFilename("music.flac")).toBe(true);
    expect(isBinaryFilename("sound.ogg")).toBe(true);
  });

  test("identifies common image extensions as binary", () => {
    expect(isBinaryFilename("photo.png")).toBe(true);
    expect(isBinaryFilename("photo.jpg")).toBe(true);
    expect(isBinaryFilename("photo.jpeg")).toBe(true);
    expect(isBinaryFilename("animation.gif")).toBe(true);
    expect(isBinaryFilename("modern.webp")).toBe(true);
  });

  test("identifies PDF and Office docs as binary", () => {
    expect(isBinaryFilename("manual.pdf")).toBe(true);
    expect(isBinaryFilename("report.docx")).toBe(true);
    expect(isBinaryFilename("budget.xlsx")).toBe(true);
    expect(isBinaryFilename("slides.pptx")).toBe(true);
  });

  test("identifies video extensions as binary", () => {
    expect(isBinaryFilename("clip.mp4")).toBe(true);
    expect(isBinaryFilename("movie.mov")).toBe(true);
    expect(isBinaryFilename("screencast.webm")).toBe(true);
  });

  test("identifies archives as binary", () => {
    expect(isBinaryFilename("bundle.zip")).toBe(true);
    expect(isBinaryFilename("backup.tar.gz")).toBe(true);
    expect(isBinaryFilename("data.7z")).toBe(true);
  });

  test("treats textual extensions as non-binary", () => {
    // Textual formats must remain on the normal get_vault_file path.
    expect(isBinaryFilename("note.md")).toBe(false);
    expect(isBinaryFilename("config.json")).toBe(false);
    expect(isBinaryFilename("config.yaml")).toBe(false);
    expect(isBinaryFilename("page.html")).toBe(false);
    expect(isBinaryFilename("data.csv")).toBe(false);
    expect(isBinaryFilename("readme.txt")).toBe(false);
    // SVG is XML text, not binary — it should NOT short-circuit.
    expect(isBinaryFilename("icon.svg")).toBe(false);
  });

  test("is case-insensitive", () => {
    expect(isBinaryFilename("RECORDING.MP3")).toBe(true);
    expect(isBinaryFilename("Photo.JPG")).toBe(true);
    expect(isBinaryFilename("Note.MD")).toBe(false);
  });

  test("returns false for files without an extension", () => {
    expect(isBinaryFilename("README")).toBe(false);
    expect(isBinaryFilename("Makefile")).toBe(false);
    expect(isBinaryFilename(".env")).toBe(false);
  });

  test("returns false for unknown extensions", () => {
    // Unknown extensions fall through to the normal text path and
    // surface any Local REST API error there — this is by design:
    // we prefer a real error over a false positive binary response.
    expect(isBinaryFilename("note.xyz")).toBe(false);
    expect(isBinaryFilename("data.unknown")).toBe(false);
  });
});

describe("guessMimeType", () => {
  test("returns canonical mime types for known binary extensions", () => {
    expect(guessMimeType("recording.mp3")).toBe("audio/mpeg");
    expect(guessMimeType("photo.png")).toBe("image/png");
    expect(guessMimeType("photo.jpg")).toBe("image/jpeg");
    expect(guessMimeType("manual.pdf")).toBe("application/pdf");
    expect(guessMimeType("clip.mp4")).toBe("video/mp4");
    expect(guessMimeType("bundle.zip")).toBe("application/zip");
  });

  test("normalizes JPEG variants to image/jpeg", () => {
    expect(guessMimeType("a.jpg")).toBe("image/jpeg");
    expect(guessMimeType("a.jpeg")).toBe("image/jpeg");
  });

  test("is case-insensitive", () => {
    expect(guessMimeType("RECORDING.MP3")).toBe("audio/mpeg");
    expect(guessMimeType("Photo.JPG")).toBe("image/jpeg");
  });

  test("falls back to application/octet-stream for unknown extensions", () => {
    expect(guessMimeType("note.xyz")).toBe("application/octet-stream");
  });

  test("falls back to application/octet-stream for files without an extension", () => {
    expect(guessMimeType("README")).toBe("application/octet-stream");
    expect(guessMimeType(".env")).toBe("application/octet-stream");
  });
});

describe("applySimpleSearchLimit — issue #62", () => {
  // The /search/simple/ endpoint has no native `limit` parameter, so we
  // slice client-side. On common search terms the server can return
  // thousands of matches and overflow the MCP client's context window
  // (Claude Desktop will write to a tool-result file, breaking flow).

  test("returns the first N elements when limit is smaller than the array", () => {
    const data = ["a", "b", "c", "d", "e"];
    expect(applySimpleSearchLimit(data, 3)).toEqual(["a", "b", "c"]);
  });

  test("returns the data unchanged when limit is undefined", () => {
    const data = [{ filename: "x.md" }, { filename: "y.md" }];
    // Preserves the upstream default — don't silently truncate.
    expect(applySimpleSearchLimit(data, undefined)).toBe(data);
  });

  test("returns all elements when limit exceeds array length", () => {
    const data = [1, 2, 3];
    expect(applySimpleSearchLimit(data, 10)).toEqual([1, 2, 3]);
  });

  test("returns an empty array when limit is 0", () => {
    // The tool schema enforces `number>0`, but the helper itself must
    // still behave sensibly if called directly with 0 — slice(0,0) → [].
    expect(applySimpleSearchLimit([1, 2, 3], 0)).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const data = [1, 2, 3, 4, 5];
    applySimpleSearchLimit(data, 2);
    expect(data).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("classifyBinaryMime — issue #59 (native SDK content blocks)", () => {
  // MCP SDK 1.29.0 can carry `image` and `audio` content blocks natively.
  // Video / PDF / Office / archive have no matching content block so the
  // server must keep returning the text metadata hint for those.

  test("classifies image/* mime types as image", () => {
    expect(classifyBinaryMime("image/png")).toBe("image");
    expect(classifyBinaryMime("image/jpeg")).toBe("image");
    expect(classifyBinaryMime("image/webp")).toBe("image");
    expect(classifyBinaryMime("image/svg+xml")).toBe("image");
    expect(classifyBinaryMime("image/x-icon")).toBe("image");
  });

  test("classifies audio/* mime types as audio", () => {
    expect(classifyBinaryMime("audio/mpeg")).toBe("audio");
    expect(classifyBinaryMime("audio/wav")).toBe("audio");
    expect(classifyBinaryMime("audio/mp4")).toBe("audio");
    expect(classifyBinaryMime("audio/ogg")).toBe("audio");
    expect(classifyBinaryMime("audio/x-ms-wma")).toBe("audio");
  });

  test("returns null for video/PDF/Office/archive mime types", () => {
    // These must fall through to the text metadata path. The SDK has no
    // content block that carries video or document payloads inline.
    expect(classifyBinaryMime("video/mp4")).toBeNull();
    expect(classifyBinaryMime("video/quicktime")).toBeNull();
    expect(classifyBinaryMime("application/pdf")).toBeNull();
    expect(
      classifyBinaryMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBeNull();
    expect(classifyBinaryMime("application/zip")).toBeNull();
    expect(classifyBinaryMime("application/octet-stream")).toBeNull();
  });

  test("returns null for missing or empty mime types", () => {
    expect(classifyBinaryMime(null)).toBeNull();
    expect(classifyBinaryMime(undefined)).toBeNull();
    expect(classifyBinaryMime("")).toBeNull();
  });

  test("is case-insensitive on the top-level type", () => {
    // HTTP Content-Type values arrive with variable casing depending on
    // the server — `IMAGE/PNG` is equally valid per RFC 7231.
    expect(classifyBinaryMime("IMAGE/PNG")).toBe("image");
    expect(classifyBinaryMime("Audio/MPEG")).toBe("audio");
  });

  test("ignores trailing parameters like charset or boundary", () => {
    // e.g. `image/svg+xml; charset=utf-8` from some servers.
    expect(classifyBinaryMime("image/png; charset=binary")).toBe("image");
    expect(classifyBinaryMime("audio/mpeg;")).toBe("audio");
  });
});

describe("buildBinaryMetadataText — issue #59 fallback path", () => {
  // Pins the exact shape of the text metadata that the handler emits when
  // the mime type is not inline-able or the file exceeds the size cap.
  // This is the only MCP-layer signal the agent has to know that it
  // should open the file via show_file_in_obsidian rather than keep
  // retrying get_vault_file.

  test("produces a JSON payload with kind, filename, mimeType, and hint", () => {
    const raw = buildBinaryMetadataText(
      "movie.mp4",
      "video/mp4",
      "unsupported_type",
    );
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({
      kind: "binary_file",
      filename: "movie.mp4",
      mimeType: "video/mp4",
    });
    expect(typeof parsed.hint).toBe("string");
    expect(parsed.hint).toContain("show_file_in_obsidian");
  });

  test("uses distinct hint text for the too_large reason", () => {
    // Tell the agent apart the two failure modes: "this format cannot be
    // inlined at all" vs "this file is too big to inline, even though
    // the format would normally be supported". The hint strings diverge
    // so an agent inspecting the payload can tell which case it hit.
    const unsupported = JSON.parse(
      buildBinaryMetadataText("x.mp4", "video/mp4", "unsupported_type"),
    ) as { hint: string };
    const tooLarge = JSON.parse(
      buildBinaryMetadataText("x.mp3", "audio/mpeg", "too_large"),
    ) as { hint: string };
    expect(unsupported.hint).not.toEqual(tooLarge.hint);
    expect(tooLarge.hint.toLowerCase()).toContain("large");
  });

  test("produces valid JSON that round-trips", () => {
    // Pretty-printed output must still parse — regression guard against
    // future refactors that might drop the JSON.stringify.
    const raw = buildBinaryMetadataText("a.zip", "application/zip", "unsupported_type");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe("encodeBytesAsBase64 — issue #59 inline-content payload", () => {
  test("encodes an empty buffer as an empty string", () => {
    expect(encodeBytesAsBase64(new Uint8Array(0))).toBe("");
  });

  test("encodes a small buffer to standard base64", () => {
    // "hi!" → aGkh in standard base64.
    const bytes = new Uint8Array([0x68, 0x69, 0x21]);
    expect(encodeBytesAsBase64(bytes)).toBe("aGkh");
  });

  test("round-trips an arbitrary byte sequence", () => {
    // Every byte value 0..255 — catches any attempt at utf-8
    // re-interpretation that would corrupt binary payloads.
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;
    const encoded = encodeBytesAsBase64(original);
    const decoded = new Uint8Array(Buffer.from(encoded, "base64"));
    expect(decoded).toEqual(original);
  });

  test("produces only characters from the base64 alphabet", () => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = (i * 7 + 11) & 0xff;
    const encoded = encodeBytesAsBase64(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe("MAX_INLINE_BINARY_BYTES — issue #59 size cap", () => {
  test("is set to 10 MiB", () => {
    // Pin the constant so a future refactor doesn't silently raise the
    // limit (which would let a large file blow the MCP client context
    // budget) or lower it (which would regress legitimate audio reads).
    expect(MAX_INLINE_BINARY_BYTES).toBe(10 * 1024 * 1024);
  });
});
