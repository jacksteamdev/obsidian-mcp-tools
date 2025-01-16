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
 * Indents the content of a list item by the specified length.
 *
 * @param content - The content of the list item to be indented.
 * @param indentLength - The number of spaces to use for indenting the content.
 * @returns The indented content of the list item.
 */
function listIndent(content: string, indentLength: number): string {
  const indent = " ".repeat(indentLength);
  return content
    .replace(/^\n+/, "") // remove leading newlines
    .replace(/\n+$/, "\n") // replace trailing newlines with just a single one
    .replace(/\n/gm, `\n${indent}`); // indent
}

/**
 * Checks if the given node is an HTMLElement.
 *
 * @param node - The node to check.
 * @returns `true` if the node is an HTMLElement, `false` otherwise.
 */
function isHTMLElement(node: Node | null): node is HTMLElement {
  // Can't use `instanceof HTMLElement` because HTMLElement is not defined in Bun runtime
  return node?.nodeType === 1;
}

/**
 * Converts HTML content to Markdown format, resolving any relative URLs
 * using the provided base URL.
 *
 * @param html - The HTML content to be converted to Markdown.
 * @param baseUrl - The base URL to use for resolving relative URLs.
 * @returns The Markdown representation of the input HTML.
 */
export function convertHtmlToMarkdown(html: string, baseUrl: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  // Add custom rules
  turndownService.addRule("removeNonSemantic", {
    filter: [
      "nav",
      "header",
      "footer",
      "aside",
      "script",
      "style",
      "meta",
      "template",
      "link",
    ],
    replacement: () => "",
  });

  turndownService.addRule("listItem", {
    filter: "li",
    replacement(content, node, options) {
      const parent = node.parentNode;
      let marker: string = options.bulletListMarker ?? "-"; // default to bullet
      if (isHTMLElement(parent) && parent?.nodeName === "OL") {
        const start = parent.getAttribute("start");
        const index = Array.prototype.indexOf.call(parent.children, node);
        marker = `${start ? Number(start) + index : index + 1}.`;
      }
      const prefix = `${marker} `;
      const liContent = listIndent(content, prefix.length);
      const trailNl = node.nextSibling && !/\n$/.test(liContent) ? "\n" : "";
      return `${prefix}${liContent}${trailNl}`;
    },
  });

  turndownService.addRule("resolveUrls", {
    filter: ["a", "img"],
    replacement: function (content, node) {
      const element = node as HTMLElement;
      if (element.tagName === "A") {
        const href = element.getAttribute("href");
        if (!href) return content;
        return `[${content}](${resolveUrl(baseUrl, href)})`;
      } else if (element.tagName === "IMG") {
        const src = element.getAttribute("src");
        const alt = element.getAttribute("alt") || "";
        if (!src || src.startsWith("data:")) return "";
        return `![${alt}](${resolveUrl(baseUrl, src)})`;
      }
      return content;
    },
  });

  // Extract article content if available
  let content = html;
  if (html.includes("<article")) {
    const start = html.indexOf("<article");
    const end = html.lastIndexOf("</article>") + 10;
    content = html.substring(start, end);
  }

  const markdown = turndownService.turndown(content);

  // Clean up whitespace
  return markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\[\n+/g, "[")
    .replace(/\n+\]/g, "]")
    .trim();
}


