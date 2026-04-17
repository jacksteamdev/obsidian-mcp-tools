import TurndownService from "turndown";

/**
 * Resolves a URL path relative to a base URL.
 *
 * @param base - The base URL to use for resolving relative paths.
 * @param path - The URL path to be resolved.
 * @returns The resolved absolute URL.
 */
function resolveUrl(base: string, path: string): string {
  // Return path if it's already absolute
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Handle absolute paths that start with /
  if (path.startsWith("/")) {
    const baseUrl = new URL(base);
    return `${baseUrl.protocol}//${baseUrl.host}${path}`;
  }

  // Resolve relative paths
  const resolved = new URL(path, base);
  return resolved.toString();
}

/**
 * Converts the given HTML content to Markdown format, resolving any relative URLs
 * using the provided base URL.
 *
 * @param html - The HTML content to be converted to Markdown.
 * @param baseUrl - The base URL to use for resolving relative URLs in the HTML.
 * @returns The Markdown representation of the input HTML.
 *
 * @example
 * ```ts
 * const html = await fetch("https://bcurio.us/resources/hdkb/gates/44");
 * const md = convertHtmlToMarkdown(await html.text(), "https://bcurio.us");
 * await Bun.write("playground/bcurious-gate-44.md", md);
 * ```
 */
export function convertHtmlToMarkdown(html: string, baseUrl: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  const rewriter = new HTMLRewriter()
    .on("script,style,meta,template,link", {
      element(element) {
        element.remove();
      },
    })
    .on("a", {
      element(element) {
        const href = element.getAttribute("href");
        if (href) {
          element.setAttribute("href", resolveUrl(baseUrl, href));
        }
      },
    })
    .on("img", {
      element(element) {
        const src = element.getAttribute("src");
        if (src?.startsWith("data:")) {
          element.remove();
        } else if (src) {
          element.setAttribute("src", resolveUrl(baseUrl, src));
        }
      },
    });

  let finalHtml = html;
  if (html.includes("<article")) {
    const articleStart = html.indexOf("<article");
    const articleEnd = html.lastIndexOf("</article>") + 10;
    finalHtml = html.substring(articleStart, articleEnd);
  }

  return turndownService
    .turndown(rewriter.transform(finalHtml))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\[\n+/g, "[")
    .replace(/\n+\]/g, "]");
}
