import * as cheerio from 'cheerio';
import type { SourceDocuments } from "shared";

/**
 * Extracts metadata from HTML content using Cheerio.
 *
 * @param html - The HTML content to extract metadata from.
 * @param url - The URL of the content (used as fallback for canonical URL).
 * @returns The extracted metadata.
 */
export function extractMetadata(
  html: string,
  url: string,
): SourceDocuments.Metadata {
  const $ = cheerio.load(html);

  const metadata: SourceDocuments.Metadata = {
    canonicalUrl: url,
    title: "",
  };

  // Extract title (with fallbacks)
  metadata.title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').text()?.trim() ||
    $('h1').text()?.trim() ||
    "";

  // Extract canonical URL
  const canonical = $('link[rel="canonical"]');
  if (canonical.length && canonical.attr('href')) {
    metadata.canonicalUrl = canonical.attr('href') || url;
  }

  // Extract author
  const author = $('meta[name="author"]');
  if (author.length && author.attr('content')) {
    metadata.author = author.attr('content');
  }

  // Extract dates
  const published = $('meta[property="article:published_time"]');
  if (published.length && published.attr('content')) {
    metadata.datePublished = published.attr('content');
  }

  const modified = $('meta[property="article:modified_time"]');
  if (modified.length && modified.attr('content')) {
    metadata.dateModified = modified.attr('content');
  }

  // Extract site name
  const siteName = $('meta[property="og:site_name"]');
  if (siteName.length && siteName.attr('content')) {
    metadata.siteName = siteName.attr('content');
  }

  return metadata;
}