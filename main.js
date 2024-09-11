import { readFileSync } from "fs";
import { createHash } from "crypto";
import jsdom from "jsdom";
import * as prettier from "prettier";

/**
 * @typedef {Record<string, {data: string, hash: string}>} NamedCodeBlocks
 */

/**
 * @typedef {Record<string, PageCodeBlocks>} PageCodeBlocks
 */

/**
 * @param {string} url
 * @returns {Document}
 */
async function getHTMLDocument(url) {
  const data = await fetch(url).then((result) => result.text());
  const dom = new jsdom.JSDOM(data);
  return dom.window.document;
}

/**
 * @param {string} data
 * @returns {string}
 */
function generateHash(data) {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

/**
 * @param {HTMLPreElement} element
 */
function codeblockFilename(element) {
  const ariaAttr = element.getAttribute("aria-label");
  const [filename, ..._description] = ariaAttr.split(" ");
  return filename;
}

/**
 * @param {string} snippetName
 */
function isTS(snippetName) {
  const [_, ext] = snippetName.split(".");
  return ["ts", "tsx"].includes(ext);
}

/**
 * Converts HTML to text, preserving semantic newlines for block-level
 * elements.
 *
 * @param {Node} node - The HTML node to perform text extraction.
 */
function innerTextPreservingNewlines(node) {
  let result = "";

  if (node.nodeType == node.TEXT_NODE) {
    // Replace repeated spaces, newlines, and tabs with a single space.
    // result = node.nodeValue.replace(/\s+/g, " ");
    result = node.nodeValue;
  } else {
    for (var i = 0, j = node.childNodes.length; i < j; i++) {
      result += innerTextPreservingNewlines(node.childNodes[i]);
    }

    if (node.tagName === "DIV" && !result.endsWith("\n")) {
      result += "\n";
    }
  }

  return result;
}

/**
 * @param {HTMLPreElement} tag
 * @param {boolean} verbose - Whether to log `prettier` errors. Default `false`.
 */
async function format(tag, verbose = false) {
  let code = innerTextPreservingNewlines(tag);
  try {
    code = await prettier.format(code, { parser: "typescript" });
  } catch (err) {
    if (verbose) {
      console.log("\n");
      console.error(err);
      console.log("\n\n");
    }
  }
  return code;
}

/**
 * @param {Document} doc
 * @returns {NamedCodeBlocks}
 */
async function getPageCodeBlocks(doc) {
  /**
   * @type {NamedCodeBlocks}
   */
  const results = {};

  for (const pre of doc.getElementsByTagName("pre")) {
    const snippetName = codeblockFilename(pre);
    if (!isTS(snippetName)) continue;
    const code = await format(pre);
    const hash = generateHash(code);
    results[snippetName] = { code, hash };
  }

  return results;
}

/**
 *
 * @param {string[]} pages
 * @returns {PageCodeBlocks}
 */
async function getAll(urls) {
  /**
   * @type {PageCodeBlocks}
   */
  const results = {};

  for (const url of urls) {
    console.log(`processing ${url}`);
    const dom = await getHTMLDocument(url);
    results[url] = await getPageCodeBlocks(dom);
  }

  return results;
}

async function findPages() {
  const sitemapURL = "https://docs.amplify.aws/sitemap.xml";
  const locTags = (await getHTMLDocument(sitemapURL)).getElementsByTagName(
    "loc"
  );
  return [...locTags]
    .map((t) => t.innerHTML)
    .filter((h) => h.includes("react/build-a-backend/data/"));
}

const urls = await findPages();
const results = await getAll(urls);
console.log(JSON.stringify(results, null, 2));
