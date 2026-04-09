"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/corpusTreeProvider.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs2 = __toESM(require("fs"));

// node_modules/@earlytexts/markit/dist/index.js
var import_node_fs = require("node:fs");
var makeError_default = ({
  message,
  line,
  length,
  column = 0,
  lines = 0,
  severity = "error"
}) => ({
  message,
  line: line + 1,
  // Convert to 1-based line number
  column: column + 1,
  // Convert to 1-based column number
  endLine: line + lines + 1,
  endColumn: column + length + 1,
  severity
});
var compileExternalChildren_default = (treeWithMetadata, options, loadingStack, compile2) => {
  const childrenPaths = treeWithMetadata.metadata.children;
  if (!childrenPaths) {
    return [[], []];
  }
  const childrenPositions = treeWithMetadata.metadataPositions.children;
  if (!Array.isArray(childrenPaths)) {
    const error = makeError_default({
      message: "The 'children' metadata field must be an array of strings (file paths)",
      line: childrenPositions.line,
      column: childrenPositions.column,
      length: "children".length
    });
    return [[], [error]];
  }
  const errors = [];
  const externalChildren = [];
  for (let i = 0; i < childrenPaths.length; i++) {
    const childPath = childrenPaths[i];
    const elementPosition = childrenPositions.arrayElementPositions[i];
    if (typeof childPath !== "string") {
      errors.push(
        makeError_default({
          message: "Each item in 'children' metadata array must be a string (file path)",
          line: elementPosition.line,
          column: elementPosition.column,
          length: elementPosition.length
        })
      );
      continue;
    }
    const resolvedPath = resolvePath(options.filePath, childPath);
    const normalizedPath = normalizePath(resolvedPath);
    if (loadingStack.has(normalizedPath)) {
      errors.push(
        makeError_default({
          message: "Circular dependency detected",
          line: elementPosition.line,
          column: elementPosition.column,
          length: elementPosition.length
        })
      );
      continue;
    } else {
      loadingStack.add(normalizedPath);
    }
    let fileContent = null;
    let actualPath = resolvedPath;
    try {
      fileContent = options.fileLoader(resolvedPath);
    } catch {
      const pathWithExtension = `${resolvedPath}.mit`;
      try {
        fileContent = options.fileLoader(pathWithExtension);
        actualPath = pathWithExtension;
      } catch {
        const indexPath = `${resolvedPath}/index.mit`;
        try {
          fileContent = options.fileLoader(indexPath);
          actualPath = indexPath;
        } catch (error) {
          errors.push(
            makeError_default({
              message: `Cannot load external child: ${childPath}`,
              line: elementPosition.line,
              column: elementPosition.column,
              length: elementPosition.length
            })
          );
          continue;
        }
      }
    }
    const [childDocument, childErrors] = compile2(
      fileContent,
      {
        ...options,
        filePath: actualPath
      },
      loadingStack
    );
    externalChildren.push(childDocument);
    errors.push(
      ...childErrors.filter((e) => e.severity !== "warning").map((error) => ({ ...error, file: childPath }))
    );
    if (childErrors.length > 0) {
      errors.push(
        makeError_default({
          message: `External child '${childPath}' has errors`,
          line: elementPosition.line,
          column: elementPosition.column,
          length: elementPosition.length,
          severity: "warning"
        })
      );
    }
  }
  return [externalChildren, errors];
};
var resolvePath = (parentPath, relativePath) => {
  if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    return relativePath;
  }
  const lastSlash = Math.max(
    parentPath.lastIndexOf("/"),
    parentPath.lastIndexOf("\\")
  );
  if (lastSlash < 0) {
    return relativePath;
  }
  const parentDir = parentPath.substring(0, lastSlash + 1);
  return `${parentDir}${relativePath}`;
};
var normalizePath = (path2) => {
  return path2.replace(/\\/g, "/").toLowerCase();
};
var generateTextTree_default = (blocks) => {
  const errors = [];
  const rootLine = blocks[0].lines[0];
  const [rootLevel, rootId] = readTextHeading(rootLine.content);
  if (rootLevel !== 1) {
    const message = rootLevel === 0 ? "Document must begin with a level 1 header (e.g. # Document.Id)" : `Expected level 1 header but found level ${rootLevel}`;
    errors.push(
      makeError_default({
        message,
        line: 0,
        length: rootLine.content.length
      })
    );
  }
  const rootText = {
    id: rootId,
    level: rootLevel,
    startLine: blocks[0].startLine,
    endLine: blocks[0].endLine,
    blocks: [],
    children: []
  };
  let currentLevel = rootLevel;
  const flatTexts = [rootText];
  blocks.slice(1).forEach((block) => {
    const firstLine = block.lines[0];
    const [level, id] = readTextHeading(firstLine.content);
    if (level > 0) {
      if (level > currentLevel + 1) {
        errors.push(
          makeError_default({
            message: `Level ${level} header cannot follow level ${currentLevel} header without an intermediate level`,
            line: block.startLine,
            length: firstLine.content.length
          })
        );
      }
      flatTexts.push({
        level,
        id,
        startLine: block.startLine,
        endLine: block.endLine,
        blocks: [],
        children: []
      });
      currentLevel = level;
    } else {
      const currentText = flatTexts.at(-1);
      currentText.blocks.push(block);
      currentText.endLine = block.endLine;
    }
  });
  flatTexts.slice(1).forEach((text, index) => {
    const parent = flatTexts.slice(0, index + 1).reverse().find((t) => t.level < text.level);
    parent.children.push(text);
  });
  fixEndLines(rootText);
  return [rootText, errors];
};
var readTextHeading = (line) => {
  const idMatch = line.trim().match(/^(#+)\s*([^\s#{}]+)/);
  const level = idMatch ? idMatch[1].length : 0;
  const id = idMatch ? idMatch[2] : "missing-id";
  return [level, id];
};
var fixEndLines = (text) => {
  if (text.children.length > 0) {
    text.children.forEach(fixEndLines);
    text.endLine = text.children.at(-1).endLine;
  }
};
var RESERVED_TEXT_KEYS = ["id", "blocks", "children"];
var RESERVED_BLOCK_KEYS = ["id", "content"];
var startLine = /* @__PURE__ */ Symbol("startLine");
var endLine = /* @__PURE__ */ Symbol("endLine");
var leafElements = [
  { trigger: "~~", type: "emSpace" },
  { trigger: "~", type: "nbSpace" },
  { trigger: "//", type: "lineBreak" },
  { trigger: "|", type: "pageBreak" }
];
var headingSpec = {
  marker: "\xA3",
  minLevel: 1,
  maxLevel: 6,
  blockLevel: true
};
var footnoteReferenceSpec = {
  open: "<",
  close: ">",
  pattern: /^n[^\s#{}]+$/,
  type: "footnoteReference"
};
var wrapperElements = [
  { open: '""', close: '""', type: "blockquote" },
  { open: '"', close: '"', type: "quote" },
  { open: "*", close: "*", type: "strong" },
  { open: "_", close: "_", type: "emphasis" },
  { open: "$$", close: "$$", type: "greek" },
  { open: "$", close: "$", type: "foreign" },
  { open: "@", close: "@", type: "aside" },
  { open: "++", close: "++", type: "insertion" },
  { open: "--", close: "--", type: "deletion" },
  { open: "[", close: "]", type: "citation" }
];
var braceCodes = [
  { code: "SS", result: "\xA7" },
  { code: "ae", result: "\xE6" },
  { code: "AE", result: "\xC6" },
  { code: "oe", result: "\u0153" },
  { code: "OE", result: "\u0152" },
  { code: "-", result: "\u2013" },
  { code: "--", result: "\u2014" }
];
var isWrapperElement = (element) => wrapperElements.some((wrapper) => wrapper.type === element.type);
var isBlockLevelType = (type) => type === "heading" || type === "blockquote" || type === "lineBreak";
var buildPositionMap_default = (block) => {
  const map = [];
  const originalLineCount = block.endLine - block.startLine + 1;
  const contentLineCount = block.lines.length;
  const tagOnOwnLine = contentLineCount < originalLineCount;
  const lineOffset = tagOnOwnLine ? 1 : 0;
  block.lines.forEach((line, lineIndex) => {
    const actualLine = block.startLine + lineOffset + lineIndex;
    for (let i = 0; i < line.content.length; i++) {
      map.push({
        line: actualLine,
        column: line.charOffset + i
      });
    }
    if (lineIndex < block.lines.length - 1) {
      map.push({
        line: actualLine,
        column: line.charOffset + line.content.length
      });
    }
  });
  return map;
};
var transliterateGreek_default = (content) => content.map(transliterateElement);
var transliterateElement = (element) => {
  if (element.type === "plainText") {
    return { ...element, content: transliterateContent(element.content) };
  } else if ("content" in element && Array.isArray(element.content)) {
    return { ...element, content: element.content.map(transliterateElement) };
  }
  return element;
};
var transliterateContent = (input) => {
  let result = "";
  let pos = 0;
  while (pos < input.length) {
    const digraph = digraphs.find(([latin]) => input.startsWith(latin, pos));
    if (digraph) {
      result += digraph[1];
      pos += digraph[0].length;
      continue;
    }
    const char = input[pos];
    const lower = lowerMap[char];
    const upper = upperMap[char];
    if (lower) {
      if (char === "s" && isWordBoundary(input[pos + 1])) {
        result += "\u03C2";
      } else {
        result += lower;
      }
      pos += 1;
    } else if (upper) {
      result += upper;
      pos += 1;
    } else {
      result += char;
      pos += 1;
    }
  }
  return result;
};
var isWordBoundary = (char) => {
  return char === void 0 || /\s/.test(char) || /[.,;:!?'"()[\]{}<>\/\\]/.test(char);
};
var digraphs = [
  ["th", "\u03B8"],
  ["Th", "\u0398"],
  ["TH", "\u0398"],
  ["ph", "\u03C6"],
  ["Ph", "\u03A6"],
  ["PH", "\u03A6"],
  ["ch", "\u03C7"],
  ["Ch", "\u03A7"],
  ["CH", "\u03A7"],
  ["ps", "\u03C8"],
  ["Ps", "\u03A8"],
  ["PS", "\u03A8"]
];
var lowerMap = {
  a: "\u03B1",
  b: "\u03B2",
  g: "\u03B3",
  d: "\u03B4",
  e: "\u03B5",
  z: "\u03B6",
  i: "\u03B9",
  k: "\u03BA",
  l: "\u03BB",
  m: "\u03BC",
  n: "\u03BD",
  x: "\u03BE",
  o: "\u03BF",
  p: "\u03C0",
  r: "\u03C1",
  s: "\u03C3",
  t: "\u03C4",
  u: "\u03C5",
  y: "\u03C5",
  w: "\u03C9",
  h: "\u03B7"
};
var upperMap = {
  A: "\u0391",
  B: "\u0392",
  G: "\u0393",
  D: "\u0394",
  E: "\u0395",
  Z: "\u0396",
  I: "\u0399",
  K: "\u039A",
  L: "\u039B",
  M: "\u039C",
  N: "\u039D",
  X: "\u039E",
  O: "\u039F",
  P: "\u03A0",
  R: "\u03A1",
  S: "\u03A3",
  T: "\u03A4",
  U: "\u03A5",
  Y: "\u03A5",
  W: "\u03A9",
  H: "\u0397"
};
var parseElements_default = (input, positionMap, footnoteIds) => {
  const errors = [];
  const [elements] = parseElements(
    input,
    0,
    null,
    false,
    positionMap,
    footnoteIds,
    errors
  );
  const cleanedElements = cleanupElements(elements);
  return [cleanedElements, errors];
};
var parseElements = (input, startPos, closeMarker, insideBlockLevel, positionMap, footnoteIds, errors) => {
  const result = [];
  let pos = startPos;
  let plainTextBuffer = "";
  const flushPlainText = () => {
    if (plainTextBuffer.length > 0) {
      result.push({ type: "plainText", content: plainTextBuffer });
      plainTextBuffer = "";
    }
  };
  while (pos < input.length) {
    if (closeMarker && input.startsWith(closeMarker, pos)) {
      flushPlainText();
      return [result, pos + closeMarker.length];
    }
    if (input[pos] === "\\") {
      if (pos + 1 < input.length) {
        plainTextBuffer += input[pos + 1];
        pos += 2;
        continue;
      } else {
        plainTextBuffer += "\\";
        pos++;
        continue;
      }
    }
    if (input[pos] === "{") {
      const closeBracePos = input.indexOf("}", pos + 1);
      if (closeBracePos === -1) {
        const position = positionMap[pos];
        errors.push(
          makeError_default({
            message: "Unclosed brace code",
            line: position.line,
            column: position.column,
            length: 1
          })
        );
        plainTextBuffer += input[pos];
        pos++;
        continue;
      }
      const code = input.slice(pos + 1, closeBracePos);
      const braceCode = braceCodes.find((bc) => bc.code === code);
      if (braceCode) {
        flushPlainText();
        result.push({ type: "plainText", content: braceCode.result });
        pos = closeBracePos + 1;
        continue;
      } else {
        const position = positionMap[pos + 1];
        errors.push(
          makeError_default({
            message: `Unknown brace code: ${code}`,
            line: position.line,
            column: position.column,
            length: code.length
          })
        );
        plainTextBuffer += input.slice(pos, closeBracePos + 1);
        pos = closeBracePos + 1;
        continue;
      }
    }
    let leafMatched = false;
    for (const leaf of [...leafElements].sort(
      (a, b) => b.trigger.length - a.trigger.length
    )) {
      if (input.startsWith(leaf.trigger, pos)) {
        flushPlainText();
        result.push({ type: leaf.type });
        pos += leaf.trigger.length;
        leafMatched = true;
        break;
      }
    }
    if (leafMatched)
      continue;
    if (input[pos] === "<") {
      const closeAnglePos = input.indexOf(">", pos + 1);
      if (closeAnglePos !== -1) {
        const refId = input.slice(pos + 1, closeAnglePos);
        if (footnoteReferenceSpec.pattern.test(refId)) {
          flushPlainText();
          result.push({ type: "footnoteReference", id: refId });
          if (!footnoteIds.includes(refId)) {
            const position = positionMap[pos];
            errors.push(
              makeError_default({
                message: `Footnote not found: ${refId}`,
                line: position.line,
                column: position.column,
                length: closeAnglePos - pos + 1
              })
            );
          }
          pos = closeAnglePos + 1;
          continue;
        }
      }
    }
    if (input[pos] === headingSpec.marker) {
      const levelChar = input[pos + 1];
      if (levelChar && /[1-6]/.test(levelChar)) {
        const level = parseInt(levelChar, 10);
        const hasSpace = input[pos + 2] === " ";
        if (hasSpace) {
          if (insideBlockLevel) {
            const position = positionMap[pos];
            errors.push(
              makeError_default({
                message: "Block-level elements cannot be nested",
                line: position.line,
                column: position.column,
                length: 3
              })
            );
            plainTextBuffer += input.slice(pos, pos + 3);
            pos += 3;
            continue;
          }
          const closeMarkerStr = `${headingSpec.marker}${level}`;
          const [headingContent, newPos] = parseElements(
            input,
            pos + 3,
            closeMarkerStr,
            true,
            positionMap,
            footnoteIds,
            errors
          );
          if (newPos === pos + 3 || !input.startsWith(closeMarkerStr, newPos - closeMarkerStr.length)) {
            const position = positionMap[pos];
            errors.push(
              makeError_default({
                message: `Unclosed heading level ${level}`,
                line: position.line,
                column: position.column,
                length: 3
              })
            );
          }
          flushPlainText();
          result.push({ type: "heading", level, content: headingContent });
          pos = newPos;
          continue;
        }
      }
    }
    let wrapperMatched = false;
    for (const wrapper of [...wrapperElements].sort(
      (a, b) => b.open.length - a.open.length
    )) {
      if (input.startsWith(wrapper.open, pos)) {
        if (isBlockLevelType(wrapper.type) && insideBlockLevel) {
          const position = positionMap[pos];
          const closeIdx = input.indexOf(
            wrapper.close,
            pos + wrapper.open.length
          );
          const endPos = closeIdx >= 0 ? closeIdx + wrapper.close.length : pos + wrapper.open.length;
          errors.push(
            makeError_default({
              message: "Block-level elements cannot be nested",
              line: position.line,
              column: position.column,
              length: endPos - pos
            })
          );
          plainTextBuffer += input.slice(pos, endPos);
          pos = endPos;
          wrapperMatched = true;
          break;
        }
        const [wrapperContent, newPos] = parseElements(
          input,
          pos + wrapper.open.length,
          wrapper.close,
          isBlockLevelType(wrapper.type) || insideBlockLevel,
          positionMap,
          footnoteIds,
          errors
        );
        if (newPos === pos + wrapper.open.length || !input.startsWith(wrapper.close, newPos - wrapper.close.length)) {
          const position = positionMap[pos];
          errors.push(
            makeError_default({
              message: `Unclosed formatting: ${wrapper.open}`,
              line: position.line,
              column: position.column,
              length: wrapper.open.length
            })
          );
        }
        flushPlainText();
        const finalContent = wrapper.type === "greek" ? transliterateGreek_default(wrapperContent) : wrapperContent;
        result.push({ type: wrapper.type, content: finalContent });
        pos = newPos;
        wrapperMatched = true;
        break;
      }
    }
    if (wrapperMatched)
      continue;
    plainTextBuffer += input[pos];
    pos++;
  }
  if (closeMarker && pos >= input.length) {
  }
  flushPlainText();
  return [result, pos];
};
var cleanupElements = (elements) => {
  const result = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.type === "plainText" && /^\s+$/.test(element.content)) {
      const prevElement = result[result.length - 1];
      const nextElement = elements[i + 1];
      if (!nextElement || prevElement && isBlockLevelType(prevElement.type) || nextElement && isBlockLevelType(nextElement.type)) {
        continue;
      }
    }
    if (element.type === "plainText") {
      const nextElement = elements[i + 1];
      if (nextElement && isBlockLevelType(nextElement.type)) {
        result.push({
          type: "plainText",
          content: element.content.trimEnd()
        });
        continue;
      }
    }
    if (element.type === "plainText") {
      const prevElement = result[result.length - 1];
      if (prevElement && isBlockLevelType(prevElement.type)) {
        result.push({
          type: "plainText",
          content: element.content.trimStart()
        });
        continue;
      }
    }
    if (element.type === "heading" || isWrapperElement(element)) {
      const cleanedContent = cleanupElements(element.content);
      if (isBlockLevelType(element.type)) {
        while (cleanedContent.length > 0 && cleanedContent[0].type === "plainText" && typeof cleanedContent[0].content === "string" && /^\s+$/.test(cleanedContent[0].content)) {
          cleanedContent.shift();
        }
        const firstElement = cleanedContent[0];
        if (firstElement && firstElement.type === "plainText" && typeof firstElement.content === "string") {
          cleanedContent[0] = {
            type: "plainText",
            content: firstElement.content.trimStart()
          };
        }
        const lastIndex = cleanedContent.length - 1;
        const lastElement = cleanedContent[lastIndex];
        if (lastElement && lastElement.type === "plainText" && typeof lastElement.content === "string") {
          cleanedContent[lastIndex] = {
            type: "plainText",
            content: lastElement.content.trimEnd()
          };
        }
      }
      result.push({ ...element, content: cleanedContent });
    } else {
      result.push(element);
    }
  }
  return result;
};
var parseContent_default = (tree, externalChildren = []) => {
  return parseTextContent(tree, externalChildren, {});
};
var parseTextContent = (text, externalChildren = [], parentMetadata) => {
  const footnoteIds = text.blocks.filter((b) => footnoteReferenceSpec.pattern.test(b.id)).map((b) => b.id);
  const blockResults = text.blocks.map(
    (block) => parseBlockContent(block, footnoteIds)
  );
  const blocks = blockResults.map((result) => result[0]);
  const blockErrors = blockResults.flatMap((result) => result[1]);
  const mergedMetadata = { ...parentMetadata, ...text.metadata };
  const childResults = text.children.map(
    (child) => parseTextContent(child, [], mergedMetadata)
  );
  const children = childResults.map((result) => result[0]);
  const childErrors = childResults.flatMap((result) => result[1]);
  const document = {
    ...mergedMetadata,
    id: text.id,
    blocks,
    children: [...children, ...externalChildren],
    [startLine]: text.startLine,
    [endLine]: text.endLine
  };
  return [document, [...blockErrors, ...childErrors]];
};
var parseBlockContent = (block, footnoteIds) => {
  const text = block.lines.map((line) => line.content).join(" ").replace(/\s+/g, " ").trim();
  const positionMap = buildPositionMap_default(block);
  const [content, errors] = parseElements_default(text, positionMap, footnoteIds);
  const parsedBlock = {
    ...block.metadata,
    id: block.id,
    content,
    [startLine]: block.startLine,
    [endLine]: block.endLine
  };
  return [parsedBlock, errors];
};
var parseMetadata_default = (textTree) => {
  return parseTextMetadata(textTree);
};
var parseTextMetadata = (text) => {
  const firstBlock = text.blocks[0];
  const firstLine = firstBlock?.lines[0];
  const isMetadata = firstLine?.content.match(/^\w+:/);
  const [metadata, metadataPositions, metadataErrors] = isMetadata ? parseMetadataBlock(firstBlock) : [{}, {}, []];
  const contentBlocks = isMetadata ? text.blocks.slice(1) : text.blocks;
  const parseBlockMetadataResult = contentBlocks.reduce(
    (acc, block) => {
      const [blockWithMetadata, blockErrors2] = parseBlockMetadata(
        block,
        acc.map((b) => b[0])
      );
      acc.push([blockWithMetadata, blockErrors2]);
      return acc;
    },
    []
  );
  const blocksWithMetadata = parseBlockMetadataResult.map(
    (result) => result[0]
  );
  const blockErrors = parseBlockMetadataResult.flatMap((result) => result[1]);
  const footnoteErrors = [];
  let firstFootnoteIndex = null;
  for (let i = 0; i < blocksWithMetadata.length; i++) {
    const isFootnote = footnoteReferenceSpec.pattern.test(
      blocksWithMetadata[i].id
    );
    if (isFootnote && firstFootnoteIndex === null) {
      firstFootnoteIndex = i;
    } else if (!isFootnote && firstFootnoteIndex !== null) {
      const footnoteBlock = blocksWithMetadata[firstFootnoteIndex];
      const rawFootnoteBlock = contentBlocks[firstFootnoteIndex];
      footnoteErrors.push(
        makeError_default({
          message: "Footnote blocks must appear after all paragraph blocks",
          line: footnoteBlock.startLine,
          column: rawFootnoteBlock.lines[0].charOffset,
          length: footnoteBlock.id.length + 3
          // {# + id + }
        })
      );
      break;
    }
  }
  const parseChildrenResult = text.children.map(parseTextMetadata);
  const childrenWithMetadata = parseChildrenResult.map((result) => result[0]);
  const childrenErrors = parseChildrenResult.flatMap((result) => result[1]);
  const textWithMetadata = {
    ...text,
    metadata,
    metadataPositions,
    blocks: blocksWithMetadata,
    children: childrenWithMetadata
  };
  const errors = [
    ...metadataErrors,
    ...blockErrors,
    ...footnoteErrors,
    ...childrenErrors
  ];
  return [textWithMetadata, errors];
};
var parseMetadataBlock = (block) => {
  const errors = [];
  const metadata = {};
  const metadataPositions = {};
  for (let index = 0; index < block.lines.length; index++) {
    const line = block.lines[index];
    const multilineArrayMatch = line.content.match(/^(\w+)\s*:\s*$/);
    if (multilineArrayMatch) {
      const key2 = multilineArrayMatch[1];
      metadataPositions[key2] = {
        line: block.startLine + index,
        column: line.charOffset,
        length: line.content.length,
        arrayElementPositions: []
      };
      const arrayItems = [];
      let arrayIndex = index + 1;
      while (arrayIndex < block.lines.length) {
        const arrayLine = block.lines[arrayIndex];
        const arrayItemMatch = arrayLine.content.match(/^- (.+)$/);
        if (!arrayItemMatch) {
          break;
        }
        const itemString = arrayItemMatch[1].trim();
        const itemStartColumn = arrayLine.charOffset + arrayLine.content.indexOf(itemString);
        metadataPositions[key2].arrayElementPositions.push(
          {
            line: block.startLine + arrayIndex,
            column: itemStartColumn,
            length: itemString.length
          }
        );
        let itemValue;
        try {
          itemValue = JSON.parse(itemString);
        } catch {
          itemValue = itemString;
          errors.push(
            makeError_default({
              message: `Invalid metadata value: ${itemString}`,
              line: block.startLine + arrayIndex,
              column: itemStartColumn,
              length: itemString.length
            })
          );
        }
        arrayItems.push(itemValue);
        arrayIndex++;
      }
      if (arrayItems.length === 0) {
        errors.push(
          makeError_default({
            message: "Multiline array must have at least one item",
            line: block.startLine + index,
            column: line.charOffset,
            length: line.content.length
          })
        );
      } else {
        const types = new Set(arrayItems.map((item) => typeof item));
        if (types.size > 1) {
          errors.push(
            makeError_default({
              message: "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
              line: block.startLine + index,
              column: line.charOffset,
              length: line.content.length
            })
          );
        }
        metadata[key2] = arrayItems;
      }
      index = arrayIndex - 1;
      continue;
    }
    const match = line.content.match(/^(\w+)\s*:\s*(.+)$/);
    if (!match) {
      errors.push(
        makeError_default({
          message: "Invalid metadata line, expected 'key: value'",
          line: block.startLine + index,
          column: line.charOffset,
          length: line.content.length
        })
      );
      continue;
    }
    const key = match[1];
    const valueString = match[2].trim();
    if (RESERVED_TEXT_KEYS.includes(key) && key !== "children") {
      errors.push(
        makeError_default({
          message: `The '${key}' metadata key is reserved and cannot be used in the document metadata`,
          line: block.startLine + index,
          column: line.charOffset,
          length: key.length
        })
      );
      continue;
    }
    metadataPositions[key] = {
      line: block.startLine + index,
      column: line.charOffset,
      length: line.content.length,
      arrayElementPositions: []
    };
    let value;
    try {
      value = JSON.parse(valueString);
    } catch {
      value = valueString;
      errors.push(
        makeError_default({
          message: `Invalid metadata value: ${valueString}`,
          line: block.startLine + index,
          column: line.charOffset + line.content.indexOf(valueString),
          length: valueString.length
        })
      );
    }
    if (Array.isArray(value)) {
      const arrayOpeningBracketIndex = line.content.indexOf(valueString);
      value.forEach((item) => {
        const itemString = JSON.stringify(item);
        const itemStartIndex = line.content.indexOf(
          itemString,
          arrayOpeningBracketIndex
        );
        metadataPositions[key].arrayElementPositions.push({
          line: block.startLine + index,
          column: line.charOffset + itemStartIndex,
          length: itemString.length
        });
      });
    }
    if (Array.isArray(value)) {
      const types = new Set(value.map((item) => typeof item));
      if (types.size > 1) {
        errors.push(
          makeError_default({
            message: "Array contains mixed types (arrays must contain only numbers, only booleans, or only strings)",
            line: block.startLine + index,
            column: line.charOffset,
            length: line.content.length
          })
        );
      }
    }
    metadata[key] = value;
  }
  return [metadata, metadataPositions, errors];
};
var parseBlockMetadata = (block, previousBlocks) => {
  const errors = [];
  const [firstLine, ...otherLines] = block.lines;
  const blockTagMatch = firstLine.content.match(/^\{#(.+?)\}/);
  if (!blockTagMatch) {
    const message = firstLine.content.trim().startsWith("{#") ? "Block tag is not properly closed with '}'" : "Block is missing metadata tag '{#id}'";
    errors.push(
      makeError_default({
        message,
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length
      })
    );
  }
  const blockTagContent = blockTagMatch ? blockTagMatch[1].trim() : `${block.startLine}`;
  const blockTagParts = blockTagContent.split(",").map((part) => part.trim());
  const id = blockTagParts[0];
  if (blockTagMatch && !/^[^\s#{}]+$/.test(id)) {
    const idOffset = firstLine.content.indexOf(id, 2);
    errors.push(
      makeError_default({
        message: `Block ID '${id}' contains invalid characters (IDs may not contain whitespace, '#', '{', or '}')`,
        line: block.startLine,
        column: firstLine.charOffset + idOffset,
        length: id.length
      })
    );
  } else if (blockTagMatch && id.startsWith("n") && !footnoteReferenceSpec.pattern.test(id)) {
    const idOffset = firstLine.content.indexOf(id, 2);
    errors.push(
      makeError_default({
        message: `Block ID '${id}' is not a valid footnote ID (footnote IDs must start with 'n' followed by at least one character)`,
        line: block.startLine,
        column: firstLine.charOffset + idOffset,
        length: id.length
      })
    );
  }
  if (previousBlocks.some((b) => b.id === id)) {
    errors.push(
      makeError_default({
        message: `Duplicate block ID: #${id}`,
        line: block.startLine,
        column: firstLine.charOffset,
        length: firstLine.content.length
      })
    );
  }
  const metadata = {};
  blockTagParts.slice(1).forEach((part) => {
    const [key, valueString] = part.split("=").map((s) => s.trim());
    if (!key || !valueString) {
      errors.push(
        makeError_default({
          message: "Invalid block metadata, expected 'key=value'",
          line: block.startLine,
          column: firstLine.charOffset + firstLine.content.indexOf(part),
          length: part.length
        })
      );
      return;
    }
    if (RESERVED_BLOCK_KEYS.includes(key)) {
      errors.push(
        makeError_default({
          message: `Block tag key '${key}' is reserved and cannot be used in metadata`,
          line: block.startLine,
          column: firstLine.charOffset + firstLine.content.indexOf(part),
          length: key.length
        })
      );
      return;
    }
    let value;
    try {
      value = JSON.parse(valueString);
    } catch {
      value = valueString;
      errors.push(
        makeError_default({
          message: `Invalid metadata value: ${valueString}`,
          line: block.startLine,
          column: firstLine.charOffset + firstLine.content.indexOf(valueString),
          length: valueString.length
        })
      );
    }
    metadata[key] = value;
  });
  const contentAfterTag = blockTagMatch ? firstLine.content.slice(blockTagMatch[0].length).trim() : firstLine.content.trim().startsWith("{#") ? "" : firstLine.content.trim();
  const newFirstLine = contentAfterTag ? {
    charOffset: firstLine.charOffset + firstLine.content.indexOf(contentAfterTag),
    content: contentAfterTag
  } : null;
  const lines = newFirstLine ? [newFirstLine, ...otherLines] : otherLines;
  const blockWithMetadata = {
    ...block,
    id,
    metadata,
    lines
  };
  return [blockWithMetadata, errors];
};
var splitIntoBlocks_default = (text) => {
  const lines = text.split("\n");
  let blankLines = 0;
  const blocks = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      blankLines++;
    } else {
      const lineObject = {
        charOffset: line.indexOf(trimmed),
        content: trimmed
      };
      if (blankLines > 0) {
        blocks.push({ startLine: index, endLine: index, lines: [lineObject] });
        blankLines = 0;
      } else {
        const lastBlock = blocks.at(-1);
        if (!lastBlock) {
          blocks.push({
            startLine: index,
            endLine: index,
            lines: [lineObject]
          });
        } else {
          lastBlock.lines.push(lineObject);
          lastBlock.endLine = index;
        }
      }
    }
  });
  return blocks;
};
var compile_default = (text, options = {}) => {
  const loadingStack = new Set(options.filePath ? [options.filePath] : []);
  return compile(text, options, loadingStack);
};
var compile = (text, optionOverrides, loadingStack = /* @__PURE__ */ new Set()) => {
  const options = {
    embedExternalChildren: true,
    fileLoader: (path2) => (0, import_node_fs.readFileSync)(path2, "utf-8"),
    filePath: "",
    ...optionOverrides
  };
  const [firstBlock, ...otherBlocks] = splitIntoBlocks_default(text);
  if (!firstBlock) {
    const emptyDocument = {
      id: "empty-document",
      blocks: [],
      children: [],
      [startLine]: 0,
      [endLine]: 0
    };
    const emptyDocumentError = makeError_default({
      message: "Document is empty",
      line: 0,
      column: 0,
      length: 0
    });
    return [emptyDocument, [emptyDocumentError]];
  }
  const [textTree, treeErrors] = generateTextTree_default([firstBlock, ...otherBlocks]);
  const [treeWithMetadata, metaDataErrors] = parseMetadata_default(textTree);
  const [document, contentErrors] = parseContent_default(treeWithMetadata);
  const [externalChildren, externalChildrenErrors] = options.embedExternalChildren ? compileExternalChildren_default(
    treeWithMetadata,
    options,
    loadingStack,
    compile
  ) : [[], []];
  const fullDocument = {
    ...document,
    children: [...document.children, ...externalChildren],
    [startLine]: document[startLine],
    [endLine]: document[endLine]
  };
  const errors = [
    ...treeErrors,
    ...metaDataErrors,
    ...externalChildrenErrors,
    ...contentErrors
  ].sort((a, b) => a.line - b.line || a.column - b.column);
  return [fullDocument, errors];
};

// src/parseIndex.ts
var fs = __toESM(require("fs"));
async function parseAuthorIndex(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const [data, errors] = compile_default(content);
    if (errors.length > 0) {
      console.warn(
        `Markit errors in ${filePath}: ${errors[0]?.message} (line ${errors[0]?.line})`
      );
    }
    if (typeof data.forename !== "string" || typeof data.surname !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
async function parseTextIndex(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const [data, errors] = compile_default(content, {
      filePath,
      embedExternalChildren: false
    });
    if (errors.length > 0) {
      console.warn(
        `Markit errors in ${filePath}: ${errors[0]?.message} (line ${errors[0]?.line})`
      );
    }
    if (typeof data.title !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// src/corpusTreeProvider.ts
var CorpusTreeProvider = class {
  constructor(corpusPath) {
    this.corpusPath = corpusPath;
  }
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  filter = "";
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  setCorpusPath(corpusPath) {
    this.corpusPath = corpusPath;
    this.refresh();
  }
  setFilter(filter) {
    this.filter = filter.toLowerCase();
    this.refresh();
  }
  getTreeItem(element) {
    if (element.type === "author") {
      const label = `${element.metadata.forename} ${element.metadata.surname}`;
      const item = new vscode.TreeItem(
        label,
        this.filter ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
      );
      item.description = `${element.metadata.birth}\u2013${element.metadata.death}`;
      item.contextValue = "author";
      item.iconPath = new vscode.ThemeIcon("person");
      return item;
    } else {
      const item = new vscode.TreeItem(
        element.metadata.title || element.metadata.breadcrumb,
        vscode.TreeItemCollapsibleState.None
      );
      item.contextValue = "work";
      item.iconPath = new vscode.ThemeIcon("book");
      item.command = {
        command: "vscode.open",
        title: "Open Text",
        arguments: [vscode.Uri.file(element.filePath)]
      };
      return item;
    }
  }
  async getChildren(element) {
    if (!this.corpusPath) {
      return [];
    }
    const dataPath = path.join(this.corpusPath, "data");
    if (!element) {
      return this.getAuthors(dataPath);
    }
    if (element.type === "author") {
      return this.getWorks(element);
    }
    return [];
  }
  async getAuthors(dataPath) {
    try {
      const entries = await fs2.promises.readdir(dataPath, {
        withFileTypes: true
      });
      const authors = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const indexPath = path.join(dataPath, entry.name, "index.mit");
        const metadata = await parseAuthorIndex(indexPath);
        if (metadata) {
          authors.push({
            type: "author",
            dirName: entry.name,
            dirPath: path.join(dataPath, entry.name),
            metadata
          });
        }
      }
      let filtered = authors;
      if (this.filter) {
        const allWorks = await Promise.all(
          authors.map((a) => this.loadWorks(a))
        );
        filtered = authors.filter((author, i) => {
          const authorName = `${author.metadata.forename} ${author.metadata.surname}`.toLowerCase();
          if (authorName.includes(this.filter)) {
            return true;
          }
          return allWorks[i].some(
            (w) => (w.metadata.title || w.metadata.breadcrumb).toLowerCase().includes(this.filter)
          );
        });
      }
      return filtered.sort(
        (a, b) => a.metadata.surname.localeCompare(b.metadata.surname)
      );
    } catch {
      return [];
    }
  }
  async getWorks(author) {
    const works = await this.loadWorks(author);
    if (!this.filter) {
      return works;
    }
    const authorName = `${author.metadata.forename} ${author.metadata.surname}`.toLowerCase();
    if (authorName.includes(this.filter)) {
      return works;
    }
    return works.filter(
      (w) => (w.metadata.title || w.metadata.breadcrumb).toLowerCase().includes(this.filter)
    );
  }
  async loadWorks(author) {
    try {
      const entries = await fs2.promises.readdir(author.dirPath, {
        withFileTypes: true
      });
      const works = [];
      for (const entry of entries) {
        let indexPath;
        if (entry.isFile() && entry.name.endsWith(".mit") && entry.name !== "index.mit") {
          indexPath = path.join(author.dirPath, entry.name);
        } else if (entry.isDirectory()) {
          indexPath = path.join(author.dirPath, entry.name, "index.mit");
          try {
            await fs2.promises.access(indexPath);
          } catch {
            continue;
          }
        } else {
          continue;
        }
        const metadata = await parseTextIndex(indexPath);
        if (metadata) {
          works.push({ type: "work", filePath: indexPath, metadata });
        }
      }
      return works.sort(
        (a, b) => (a.metadata.title || "").localeCompare(b.metadata.title || "")
      );
    } catch {
      return [];
    }
  }
};

// src/controlsProvider.ts
var vscode2 = __toESM(require("vscode"));
var ControlsProvider = class {
  static viewId = "compositor.controls";
  view;
  _onDidSearch = new vscode2.EventEmitter();
  onDidSearch = this._onDidSearch.event;
  resolveWebviewView(webviewView, _context, _token) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "showPreview") {
        vscode2.commands.executeCommand("markit.showPreview");
      } else if (message.command === "search") {
        this._onDidSearch.fire(message.query);
      }
    });
    this.update();
  }
  update() {
    if (!this.view) {
      return;
    }
    const editor = vscode2.window.activeTextEditor;
    const isMit = editor !== void 0 && editor.document.fileName.endsWith(".mit");
    this.view.webview.html = this.getHtml(isMit);
  }
  getHtml(isMit) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      padding: 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
    }
    input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 4px 8px;
      margin: 4px 0 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: var(--vscode-font-size);
      outline: none;
    }
    input:focus {
      border-color: var(--vscode-focusBorder);
    }
    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    button {
      display: block;
      width: 100%;
      padding: 6px 14px;
      margin: 4px 0;
      border: none;
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }
    button:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
  </style>
</head>
<body>
  <input id="searchInput" type="text" placeholder="Filter authors and texts\u2026" />
  <button id="previewBtn" ${isMit ? "" : "disabled"}>Open Preview to the Side</button>
  <script>
    const vscode = acquireVsCodeApi();
    let debounceTimer;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        vscode.postMessage({ command: "search", query: e.target.value });
      }, 200);
    });
    document.getElementById("previewBtn").addEventListener("click", () => {
      vscode.postMessage({ command: "showPreview" });
    });
  </script>
</body>
</html>`;
  }
};

// src/extension.ts
function activate(context) {
  const config = vscode3.workspace.getConfiguration("compositor");
  const corpusPath = config.get("corpusPath", "");
  const treeProvider = new CorpusTreeProvider(corpusPath);
  const treeView = vscode3.window.createTreeView("compositor.corpusBrowser", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  const controlsProvider = new ControlsProvider();
  context.subscriptions.push(
    vscode3.window.registerWebviewViewProvider(
      ControlsProvider.viewId,
      controlsProvider
    )
  );
  context.subscriptions.push(
    vscode3.window.onDidChangeActiveTextEditor(() => {
      controlsProvider.update();
    })
  );
  context.subscriptions.push(
    controlsProvider.onDidSearch((query) => {
      treeProvider.setFilter(query);
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("compositor.refreshCorpus", () => {
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode3.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("compositor.corpusPath")) {
        const newPath = vscode3.workspace.getConfiguration("compositor").get("corpusPath", "");
        treeProvider.setCorpusPath(newPath);
      }
    })
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
