import { readFileSync } from "fs";
import { createHash } from "crypto";
import jsdom from "jsdom";
import * as prettier from "prettier";

/**
 * @param {string} data
 * @returns {string}
 */
function generateHash(data) {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

/**
 * @param {string} file path to file
 */
function pagePreTags(filepath) {
  const html = readFileSync(filepath).toString();
  const dom = new jsdom.JSDOM(html);
  return dom.window.document.getElementsByTagName("pre");
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
 */
async function format(tag) {
  let code = innerTextPreservingNewlines(tag);
  try {
    code = await prettier.format(code, { parser: "typescript" });
  } catch (err) {
    console.log("\n");
    console.error(err);
    console.log("\n\n");
  }
  return code;
}

/**
 * @type {Map<string, {data: string, hash: string}>}
 */
const results = new Map();

const page = "./sample-data/setup-data.html";
for (const pre of pagePreTags(page)) {
  const snippetName = codeblockFilename(pre);
  if (!isTS(snippetName)) {
    console.log(`Skipping ${snippetName} ...`);
    continue;
  }
  const code = await format(pre);
  const hash = generateHash(code);
  results.set(`${page}:${snippetName}`, { code, hash });
}

console.log(JSON.stringify(Object.fromEntries(results.entries()), null, 2));
