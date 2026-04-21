import { describe, expect, test } from "bun:test";
import {
  applySimpleSearchLimit,
  extractFileExtension,
  guessMimeType,
  isBinaryFilename,
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
