import { JSDOM } from "jsdom";
import type { DocumentMetadata } from "../types";

/**
 * Extracts metadata from HTML content.
 *
 * @param html - The HTML content to extract metadata from.
 * @param url - The URL of the content (used as fallback for canonical URL).
 * @returns The extracted metadata.
 */

export function extractMetadata(html: string, url: string): DocumentMetadata {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const metadata: DocumentMetadata = {
    canonicalUrl: url,
    title: "",
  };

  // Extract title (with fallbacks)
  metadata.title =
    doc
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content")
      ?.trim() ||
    doc.querySelector("title")?.textContent?.trim() ||
    doc.querySelector("h1")?.textContent?.trim() ||
    "";

  // Extract canonical URL
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical?.hasAttribute("href")) {
    metadata.canonicalUrl = canonical.getAttribute("href") || url;
  }

  // Extract author
  const author = doc.querySelector('meta[name="author"]');
  if (author?.hasAttribute("content")) {
    metadata.author = author.getAttribute("content") || undefined;
  }

  // Extract dates
  const published = doc.querySelector(
    'meta[property="article:published_time"]',
  );
  if (published?.hasAttribute("content")) {
    metadata.datePublished = published.getAttribute("content") || undefined;
  }

  const modified = doc.querySelector('meta[property="article:modified_time"]');
  if (modified?.hasAttribute("content")) {
    metadata.dateModified = modified.getAttribute("content") || undefined;
  }

  // Extract site name
  const siteName = doc.querySelector('meta[property="og:site_name"]');
  if (siteName?.hasAttribute("content")) {
    metadata.siteName = siteName.getAttribute("content") || undefined;
  }

  return metadata;
}
