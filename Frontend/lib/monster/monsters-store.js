import { readMonsterJsonDataset } from "./monster-json-reader";
const SUPPORTED_TEMPLATE_NAMES = new Set([
  "Skeleton",
  "Awakened",
  "Vistana",
  "Drow",
  "Drow (Levitate)",
  "Goblin",
  "Kobold",
  "Orc",
  "Dracolich",
  "Merfolk",
  "Mountain Dwarf",
  "Shield Dwarf",
  "Aarakocra",
  "Deep Gnome",
  "Rock Gnome",
  "Lightfoot Halfling",
  "Large or Smaller Half-Blue Dragon",
  "Large or Smaller Half-Green Dragon",
  "Large or Smaller Half-Red Dragon",
  "Wood Elf",
  "Reduced Threat"
]);
const SIZE_ORDER = ["T", "S", "M", "L", "H", "G"];
const CR_XP_TABLE = new Map([
  ["0", 0],
  ["1/8", 25],
  ["1/4", 50],
  ["1/2", 100],
  ["1", 200],
  ["2", 450],
  ["3", 700],
  ["4", 1100],
  ["5", 1800],
  ["6", 2300],
  ["7", 2900],
  ["8", 3900],
  ["9", 5000],
  ["10", 5900],
  ["11", 7200],
  ["12", 8400],
  ["13", 10000],
  ["14", 11500],
  ["15", 13000],
  ["16", 15000],
  ["17", 18000],
  ["18", 20000],
  ["19", 22000],
  ["20", 25000],
  ["21", 33000],
  ["22", 41000],
  ["23", 50000],
  ["24", 62000],
  ["25", 75000],
  ["26", 90000],
  ["27", 105000],
  ["28", 120000],
  ["29", 135000],
  ["30", 155000]
]);

let monstersCache = {
  data: null,
  signature: null,
  byExactName: null
};
let pendingLoad = null;
const DEFAULT_BACKEND_API_BASE_URL = "http://localhost:8086/api";
const pendingTokenResolutions = new Map();

function resolveBackendApiBaseUrl() {
  const configuredBaseUrl = process.env.BACKEND_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  return DEFAULT_BACKEND_API_BASE_URL;
}

function normalizeTokenText(value) {
  return String(value ?? "").trim();
}

function normalizeSourceCodes(value) {
  if (Array.isArray(value)) {
    const normalizedSources = value
      .map((item) => normalizeTokenText(item))
      .filter(Boolean);
    return Array.from(new Set(normalizedSources));
  }

  const normalized = normalizeTokenText(value);
  return normalized ? [normalized] : [];
}

function hasTokenImage(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  return false;
}

function isMonsterTokenCandidate(monster) {
  if (!isPlainObject(monster)) {
    return false;
  }

  return hasTokenImage(monster.hasToken) && Boolean(normalizeTokenText(monster.name)) && normalizeSourceCodes(monster.source).length > 0;
}

function normalizeMonsterTokenRequestContext(requestContext) {
  if (!isPlainObject(requestContext)) {
    return {
      cookie: "",
      xsrfToken: "",
      backendApiBaseUrl: ""
    };
  }

  const cookie = typeof requestContext.cookie === "string" ? requestContext.cookie.trim() : "";
  const xsrfToken = typeof requestContext.xsrfToken === "string" ? requestContext.xsrfToken.trim() : "";
  const backendApiBaseUrl = typeof requestContext.backendApiBaseUrl === "string"
    ? requestContext.backendApiBaseUrl.trim().replace(/\/+$/, "")
    : "";

  return {
    cookie,
    xsrfToken,
    backendApiBaseUrl
  };
}

function buildMonsterTokenResolutionKey(monsterName, sourceCodes) {
  const normalizedName = normalizeTokenText(monsterName).toLowerCase();
  const normalizedSources = sourceCodes
    .map((sourceCode) => normalizeTokenText(sourceCode).toUpperCase())
    .filter(Boolean);

  return `${normalizedSources.join("|")}::${normalizedName}`;
}

function normalizeMonsterTokenImageUrl(downloadUrl, backendApiBaseUrl) {
  if (typeof downloadUrl !== "string") {
    return null;
  }

  const normalizedUrl = downloadUrl.trim();
  if (!normalizedUrl) {
    return null;
  }

  const normalizedBackendApiBaseUrl = typeof backendApiBaseUrl === "string"
    ? backendApiBaseUrl.trim().replace(/\/+$/, "")
    : "";

  const buildApiAssetUrl = (assetPath) => {
    if (!normalizedBackendApiBaseUrl || !assetPath.startsWith("/")) {
      return null;
    }

    return new URL(assetPath.slice(1), `${normalizedBackendApiBaseUrl}/`).toString();
  };

  if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
    if (!normalizedBackendApiBaseUrl) {
      return normalizedUrl;
    }

    try {
      const absoluteUrl = new URL(normalizedUrl);
      if (absoluteUrl.pathname.startsWith("/v1/assets/")) {
        const normalizedAssetPath = `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
        return buildApiAssetUrl(normalizedAssetPath) || normalizedUrl;
      }
    } catch {
      return normalizedUrl;
    }

    return normalizedUrl;
  }

  if (normalizedUrl.startsWith("/")) {
    if (normalizedUrl.startsWith("/v1/assets/")) {
      return buildApiAssetUrl(normalizedUrl);
    }

    return buildApiAssetUrl(normalizedUrl);
  }

  return null;
}

async function resolveMonsterTokenImageFromBackend(monsterName, sourceCodes, requestContext = null) {
  if (!monsterName || sourceCodes.length === 0) {
    return null;
  }

  const normalizedContext = normalizeMonsterTokenRequestContext(requestContext);
  const backendApiBaseUrl = normalizedContext.backendApiBaseUrl || resolveBackendApiBaseUrl();
  const params = new URLSearchParams();
  params.set("name", monsterName);
  for (const sourceCode of sourceCodes) {
    params.append("source", sourceCode);
  }

  const headers = {
    Accept: "application/json"
  };
  if (normalizedContext.cookie) {
    headers.Cookie = normalizedContext.cookie;
  }
  if (normalizedContext.xsrfToken) {
    headers["X-XSRF-TOKEN"] = normalizedContext.xsrfToken;
  }

  try {
    const response = await fetch(`${backendApiBaseUrl}/v1/monster-token-images/resolve?${params.toString()}`, {
      method: "GET",
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!isPlainObject(payload)) {
      return null;
    }

    const status = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : "";
    if (status !== "cached" && status !== "downloaded") {
      return null;
    }

    return normalizeMonsterTokenImageUrl(payload.downloadUrl, backendApiBaseUrl);
  } catch {
    return null;
  }
}

async function ensureMonsterTokenImage(monster, requestContext = null) {
  if (!isMonsterTokenCandidate(monster)) {
    return null;
  }

  const monsterName = normalizeTokenText(monster.name);
  const sourceCodes = normalizeSourceCodes(monster.source);
  if (!monsterName || sourceCodes.length === 0) {
    return null;
  }

  const resolutionKey = buildMonsterTokenResolutionKey(monsterName, sourceCodes);
  if (!resolutionKey) {
    return null;
  }

  if (pendingTokenResolutions.has(resolutionKey)) {
    return pendingTokenResolutions.get(resolutionKey);
  }

  const pendingResolution = (async () => {
    try {
      return await resolveMonsterTokenImageFromBackend(monsterName, sourceCodes, requestContext);
    } catch {
      return null;
    } finally {
      pendingTokenResolutions.delete(resolutionKey);
    }
  })();

  pendingTokenResolutions.set(resolutionKey, pendingResolution);
  return pendingResolution;
}

async function enrichMonsterWithTokenImage(monster, requestContext = null) {
  if (!isPlainObject(monster)) {
    return monster;
  }

  if (!isMonsterTokenCandidate(monster)) {
    return monster;
  }

  const tokenImage = await ensureMonsterTokenImage(monster, requestContext);
  if (!tokenImage) {
    return {
      ...monster,
      image: null
    };
  }

  return {
    ...monster,
    image: tokenImage
  };
}

function normalizeNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepMerge(baseValue, overrideValue) {
  if (overrideValue === undefined) {
    return cloneJson(baseValue);
  }

  if (Array.isArray(overrideValue)) {
    return cloneJson(overrideValue);
  }

  if (!isPlainObject(overrideValue)) {
    return overrideValue;
  }

  const base = isPlainObject(baseValue) ? baseValue : {};
  const merged = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(overrideValue)]);

  for (const key of keys) {
    if (key in overrideValue) {
      merged[key] = deepMerge(base[key], overrideValue[key]);
    } else {
      merged[key] = cloneJson(base[key]);
    }
  }

  return merged;
}

function formatCopyError(message) {
  return message;
}

const SKILL_TO_ABILITY = {
  acrobatics: "dex",
  "animal handling": "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  "sleight of hand": "dex",
  stealth: "dex",
  survival: "wis"
};
const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

function applyTextCase(template, replacement) {
  if (!template) {
    return replacement;
  }

  if (template === template.toUpperCase()) {
    return replacement.toUpperCase();
  }

  if (template[0] === template[0].toUpperCase()) {
    return `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`;
  }

  return replacement;
}

function formatSignedNumber(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function normalizePropPath(prop) {
  return String(prop ?? "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function setNestedProp(target, pathSegments, value) {
  if (pathSegments.length === 0) {
    return cloneJson(value);
  }

  const updated = isPlainObject(target) ? { ...target } : {};
  let cursor = updated;
  let sourceCursor = isPlainObject(target) ? target : {};

  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    const sourceValue = isPlainObject(sourceCursor[segment]) ? sourceCursor[segment] : {};
    cursor[segment] = isPlainObject(cursor[segment]) ? { ...cursor[segment] } : { ...sourceValue };
    cursor = cursor[segment];
    sourceCursor = sourceValue;
  }

  cursor[pathSegments[pathSegments.length - 1]] = cloneJson(value);
  return updated;
}

function getNestedProp(target, pathSegments) {
  let cursor = target;

  for (const segment of pathSegments) {
    if (!isPlainObject(cursor) || !(segment in cursor)) {
      return undefined;
    }

    cursor = cursor[segment];
  }

  return cursor;
}

function deleteNestedProp(target, pathSegments) {
  if (!isPlainObject(target) || pathSegments.length === 0) {
    return target;
  }

  const [segment, ...rest] = pathSegments;
  const updated = { ...target };

  if (rest.length === 0) {
    delete updated[segment];
    return updated;
  }

  if (!isPlainObject(updated[segment])) {
    return updated;
  }

  updated[segment] = deleteNestedProp(updated[segment], rest);
  return updated;
}

function parseCrNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (text.includes("/")) {
    const [numerator, denominator] = text.split("/");
    const num = Number(numerator);
    const den = Number(denominator);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return null;
    }

    return num / den;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function getMonsterCrNumber(monster) {
  if (!isPlainObject(monster)) {
    return null;
  }

  if (isPlainObject(monster.cr)) {
    return parseCrNumber(monster.cr.cr);
  }

  return parseCrNumber(monster.cr);
}

function getProficiencyBonus(monster) {
  const cr = getMonsterCrNumber(monster);
  if (cr === null) {
    return 2;
  }

  if (cr <= 4) {
    return 2;
  }

  if (cr <= 8) {
    return 3;
  }

  if (cr <= 12) {
    return 4;
  }

  if (cr <= 16) {
    return 5;
  }

  if (cr <= 20) {
    return 6;
  }

  if (cr <= 24) {
    return 7;
  }

  if (cr <= 28) {
    return 8;
  }

  return 9;
}

function getAbilityModifier(monster, abilityKey) {
  if (!abilityKey || !isPlainObject(monster)) {
    return 0;
  }

  const score = Number(monster[abilityKey]);
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.floor((score - 10) / 2);
}

function formatDamageModifier(value) {
  if (!Number.isFinite(value) || value === 0) {
    return "";
  }

  return value > 0 ? ` + ${value}` : ` - ${Math.abs(value)}`;
}

function getDefaultXpForCrValue(crValue) {
  if (crValue === null || crValue === undefined || crValue === "") {
    return null;
  }

  const key = String(crValue).trim();
  return CR_XP_TABLE.has(key) ? CR_XP_TABLE.get(key) : null;
}

function scaleNumber(value, scalar, floor) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const scaled = numeric * scalar;
  return floor ? Math.floor(scaled) : scaled;
}

function parseNumericLike(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { numeric: value, originalType: "number", hadExplicitPlus: false };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
      return {
        numeric: Number(trimmed),
        originalType: "string",
        hadExplicitPlus: trimmed.startsWith("+")
      };
    }
  }

  return null;
}

function formatNumericLike(parsed, value) {
  if (!parsed) {
    return value;
  }

  if (parsed.originalType === "number") {
    return value;
  }

  if (parsed.hadExplicitPlus || value < 0) {
    return formatSignedNumber(value);
  }

  return String(value);
}

function getShortName(monster, { title = false } = {}) {
  if (!isPlainObject(monster)) {
    return title ? "The creature" : "the creature";
  }

  const rawName =
    typeof monster.shortName === "string" && monster.shortName.trim()
      ? monster.shortName.trim()
      : typeof monster.name === "string" && monster.name.trim()
        ? monster.name.trim()
        : "creature";

  if (monster.isNamedCreature) {
    return rawName;
  }

  if (/^(the|a|an)\b/i.test(rawName)) {
    if (title) {
      return rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }

    return rawName.charAt(0).toLowerCase() + rawName.slice(1);
  }

  const lowered = rawName.toLowerCase();
  return title ? `The ${lowered}` : `the ${lowered}`;
}

function evaluatePlaceholderExpression(expression, monster) {
  const normalized = String(expression ?? "").replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  const tokens = normalized.match(/[+-]?[^+-]+/g);
  if (!tokens) {
    return null;
  }

  let total = 0;

  for (const token of tokens) {
    const sign = token.startsWith("-") ? -1 : 1;
    const body = token.startsWith("+") || token.startsWith("-") ? token.slice(1) : token;

    let value;
    if (ABILITY_KEYS.has(body)) {
      value = getAbilityModifier(monster, body);
    } else {
      value = Number(body);
    }

    if (!Number.isFinite(value)) {
      return null;
    }

    total += sign * value;
  }

  return total;
}

function resolvePlaceholderToken(token, monster) {
  switch (token) {
    case "title_short_name":
      return getShortName(monster, { title: true });
    case "short_name":
      return getShortName(monster, { title: false });
    default:
      break;
  }

  if (token.startsWith("spell_dc__")) {
    const ability = token.slice("spell_dc__".length);
    return String(8 + getProficiencyBonus(monster) + getAbilityModifier(monster, ability));
  }

  if (token.startsWith("to_hit__")) {
    const ability = token.slice("to_hit__".length);
    return formatSignedNumber(getProficiencyBonus(monster) + getAbilityModifier(monster, ability));
  }

  if (token.startsWith("damage_mod__")) {
    const ability = token.slice("damage_mod__".length);
    return formatDamageModifier(getAbilityModifier(monster, ability));
  }

  if (token.startsWith("damage_avg__")) {
    const expression = token.slice("damage_avg__".length);
    const value = evaluatePlaceholderExpression(expression, monster);
    return Number.isFinite(value) ? String(Math.floor(value)) : `<$${token}$>`;
  }

  return `<$${token}$>`;
}

function resolveTemplatePlaceholders(value, monster) {
  if (typeof value === "string") {
    return value.replace(/<\$([^$>]+)\$>/g, (_, token) => resolvePlaceholderToken(String(token), monster));
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplatePlaceholders(item, monster));
  }

  if (isPlainObject(value)) {
    const updated = {};
    for (const [key, item] of Object.entries(value)) {
      updated[key] = resolveTemplatePlaceholders(item, monster);
    }

    return updated;
  }

  return value;
}

function hasTemplatePlaceholders(value) {
  if (typeof value === "string") {
    return value.includes("<$");
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasTemplatePlaceholders(item));
  }

  if (isPlainObject(value)) {
    return Object.values(value).some((item) => hasTemplatePlaceholders(item));
  }

  return false;
}

function replaceTextRecursive(value, regex, replacement) {
  if (typeof value === "string") {
    return value.replace(regex, (match) => applyTextCase(match, replacement));
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTextRecursive(item, regex, replacement));
  }

  if (isPlainObject(value)) {
    const updated = {};
    for (const [key, item] of Object.entries(value)) {
      updated[key] = replaceTextRecursive(item, regex, replacement);
    }

    return updated;
  }

  return value;
}

function mapTextRecursive(value, transform) {
  if (typeof value === "string") {
    return transform(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapTextRecursive(item, transform));
  }

  if (isPlainObject(value)) {
    const updated = {};
    for (const [key, item] of Object.entries(value)) {
      updated[key] = mapTextRecursive(item, transform);
    }

    return updated;
  }

  return value;
}

function adjustHitBonusesInText(text, scalar) {
  const adjustSigned = (rawValue) => {
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) ? formatSignedNumber(numeric + scalar) : rawValue;
  };

  let updated = text.replace(/(\bAttack Roll:\s*)([+-]\d+)/gi, (_, prefix, rawValue) => {
    return `${prefix}${adjustSigned(rawValue)}`;
  });

  updated = updated.replace(/([+-]\d+)(?=(?:\})?\s*to hit\b)/gi, (rawValue) => adjustSigned(rawValue));
  return updated;
}

function adjustDcsInText(text, scalar) {
  return text.replace(/\b(DC:?\s*)(\d+)\b/gi, (_, prefix, rawValue) => {
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) ? `${prefix}${numeric + scalar}` : `${prefix}${rawValue}`;
  });
}

function isArrayEntryEquivalent(left, right) {
  const leftPrimitive = typeof left === "string" || typeof left === "number" || typeof left === "boolean";
  const rightPrimitive = typeof right === "string" || typeof right === "number" || typeof right === "boolean";

  if (leftPrimitive || rightPrimitive) {
    return String(left) === String(right);
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeSenseEntry(entry) {
  if (entry === null || entry === undefined) {
    return null;
  }

  if (typeof entry === "string") {
    return entry;
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  const type = entry.type ? String(entry.type) : "";
  const range = entry.range !== undefined && entry.range !== null ? String(entry.range) : "";
  const condition = entry.condition ? ` ${String(entry.condition)}` : "";

  if (!type) {
    return null;
  }

  if (range) {
    return `${type} ${range} ft.${condition}`;
  }

  return `${type}${condition}`;
}

function applyReplaceTxt(target, pathKey, operation, errors, ownerName) {
  let regex;

  try {
    regex = new RegExp(String(operation.replace ?? ""), "gi");
  } catch {
    errors.push(
      formatCopyError(`_copy ${ownerName}: invalid replaceTxt pattern "${String(operation.replace ?? "")}"`)
    );
    return target;
  }

  const replacement = String(operation.with ?? "");

  if (pathKey === "*") {
    return replaceTextRecursive(target, regex, replacement);
  }

  if (!isPlainObject(target) || !(pathKey in target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: replaceTxt target "${pathKey}" not found`));
    return target;
  }

  return {
    ...target,
    [pathKey]: replaceTextRecursive(target[pathKey], regex, replacement)
  };
}

function applyReplaceArr(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || !Array.isArray(target[pathKey])) {
    errors.push(formatCopyError(`_copy ${ownerName}: replaceArr requires array field "${pathKey}"`));
    return target;
  }

  if (operation.replace === undefined || operation.items === undefined) {
    errors.push(formatCopyError(`_copy ${ownerName}: replaceArr for "${pathKey}" requires "replace" and "items"`));
    return target;
  }

  const replaceValue = String(operation.replace);
  const replacementItems = Array.isArray(operation.items)
    ? cloneJson(operation.items)
    : [cloneJson(operation.items)];

  let replacedCount = 0;
  const updatedArray = [];

  for (const item of target[pathKey]) {
    const itemName = isPlainObject(item) && typeof item.name === "string" ? item.name : null;
    const primitiveValue =
      typeof item === "string" || typeof item === "number" || typeof item === "boolean"
        ? String(item)
        : null;

    if (itemName === replaceValue || primitiveValue === replaceValue) {
      updatedArray.push(...cloneJson(replacementItems));
      replacedCount += 1;
      continue;
    }

    updatedArray.push(item);
  }

  if (replacedCount === 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: replaceArr target "${replaceValue}" not found in "${pathKey}"`));
    return target;
  }

  return {
    ...target,
    [pathKey]: updatedArray
  };
}

function normalizeOperationValues(value) {
  if (value === undefined) {
    return [];
  }

  return (Array.isArray(value) ? value : [value])
    .map((item) => (item === null || item === undefined ? "" : String(item)))
    .filter(Boolean);
}

function applyRemoveArr(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || !Array.isArray(target[pathKey])) {
    errors.push(formatCopyError(`_copy ${ownerName}: removeArr requires array field "${pathKey}"`));
    return target;
  }

  const namesToRemove = new Set(normalizeOperationValues(operation.names));
  const itemsToRemove = new Set(normalizeOperationValues(operation.items));

  if (namesToRemove.size === 0 && itemsToRemove.size === 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: removeArr for "${pathKey}" requires "names" or "items"`));
    return target;
  }

  let removedCount = 0;
  const updatedArray = target[pathKey].filter((item) => {
    const itemName = isPlainObject(item) && typeof item.name === "string" ? item.name : null;
    const primitiveValue =
      typeof item === "string" || typeof item === "number" || typeof item === "boolean"
        ? String(item)
        : null;

    const shouldRemove =
      (itemName !== null && namesToRemove.has(itemName)) ||
      (primitiveValue !== null && itemsToRemove.has(primitiveValue));

    if (shouldRemove) {
      removedCount += 1;
      return false;
    }

    return true;
  });

  if (removedCount === 0) {
    if (operation.force) {
      return target;
    }

    errors.push(formatCopyError(`_copy ${ownerName}: removeArr removed nothing from "${pathKey}"`));
    return target;
  }

  return {
    ...target,
    [pathKey]: updatedArray
  };
}

function applyAppendArr(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: appendArr requires object target for "${pathKey}"`));
    return target;
  }

  const targetArray =
    target[pathKey] === undefined
      ? []
      : Array.isArray(target[pathKey])
        ? target[pathKey]
        : null;

  if (!targetArray) {
    errors.push(formatCopyError(`_copy ${ownerName}: appendArr requires array field "${pathKey}"`));
    return target;
  }

  if (operation.items === undefined) {
    errors.push(formatCopyError(`_copy ${ownerName}: appendArr for "${pathKey}" requires "items"`));
    return target;
  }

  const itemsToAppend = Array.isArray(operation.items) ? cloneJson(operation.items) : [cloneJson(operation.items)];

  return {
    ...target,
    [pathKey]: targetArray.concat(itemsToAppend)
  };
}

function applyPrependArr(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: prependArr requires object target for "${pathKey}"`));
    return target;
  }

  const targetArray =
    target[pathKey] === undefined
      ? []
      : Array.isArray(target[pathKey])
        ? target[pathKey]
        : null;

  if (!targetArray) {
    errors.push(formatCopyError(`_copy ${ownerName}: prependArr requires array field "${pathKey}"`));
    return target;
  }

  if (operation.items === undefined) {
    errors.push(formatCopyError(`_copy ${ownerName}: prependArr for "${pathKey}" requires "items"`));
    return target;
  }

  const itemsToPrepend = Array.isArray(operation.items) ? cloneJson(operation.items) : [cloneJson(operation.items)];

  return {
    ...target,
    [pathKey]: itemsToPrepend.concat(targetArray)
  };
}

function applyInsertArr(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: insertArr requires object target for "${pathKey}"`));
    return target;
  }

  const targetArray =
    target[pathKey] === undefined
      ? []
      : Array.isArray(target[pathKey])
        ? target[pathKey]
        : null;

  if (!targetArray) {
    errors.push(formatCopyError(`_copy ${ownerName}: insertArr requires array field "${pathKey}"`));
    return target;
  }

  if (operation.index === undefined || operation.items === undefined) {
    errors.push(formatCopyError(`_copy ${ownerName}: insertArr for "${pathKey}" requires "index" and "items"`));
    return target;
  }

  const rawIndex = Number.parseInt(String(operation.index), 10);
  if (!Number.isInteger(rawIndex) || rawIndex < 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: invalid insertArr index "${String(operation.index)}" for "${pathKey}"`));
    return target;
  }

  const itemsToInsert = Array.isArray(operation.items) ? cloneJson(operation.items) : [cloneJson(operation.items)];
  const index = Math.min(rawIndex, targetArray.length);

  return {
    ...target,
    [pathKey]: targetArray.slice(0, index).concat(itemsToInsert, targetArray.slice(index))
  };
}

function applyAddSkills(target, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: addSkills requires object target`));
    return target;
  }

  if (!isPlainObject(operation.skills)) {
    errors.push(formatCopyError(`_copy ${ownerName}: addSkills requires "skills"`));
    return target;
  }

  const nextSkills = isPlainObject(target.skill) ? { ...target.skill } : target.skill === undefined ? {} : null;
  if (!nextSkills) {
    errors.push(formatCopyError(`_copy ${ownerName}: addSkills requires object field "skill"`));
    return target;
  }

  const proficiencyBonus = getProficiencyBonus(target);

  for (const [skillNameRaw, proficiencyMultiplierRaw] of Object.entries(operation.skills)) {
    const skillName = String(skillNameRaw).toLowerCase();
    const abilityKey = SKILL_TO_ABILITY[skillName];
    const proficiencyMultiplier = Number(proficiencyMultiplierRaw);

    if (!abilityKey) {
      errors.push(formatCopyError(`_copy ${ownerName}: addSkills unknown skill "${skillNameRaw}"`));
      continue;
    }

    if (!Number.isFinite(proficiencyMultiplier)) {
      errors.push(formatCopyError(`_copy ${ownerName}: addSkills invalid value for "${skillNameRaw}"`));
      continue;
    }

    const totalBonus = getAbilityModifier(target, abilityKey) + Math.round(proficiencyBonus * proficiencyMultiplier);
    nextSkills[skillName] = formatSignedNumber(totalBonus);
  }

  return {
    ...target,
    skill: nextSkills
  };
}

function applySetProp(target, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: setProp requires object target`));
    return target;
  }

  if (typeof operation.prop !== "string" || operation.prop.trim() === "") {
    errors.push(formatCopyError(`_copy ${ownerName}: setProp requires "prop"`));
    return target;
  }

  const prop = operation.prop.trim();
  const pathSegments = normalizePropPath(prop);

  if (pathSegments.length === 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: setProp requires valid "prop"`));
    return target;
  }

  if (operation.value === null) {
    return deleteNestedProp(target, pathSegments);
  }

  return setNestedProp(target, pathSegments, operation.value);
}

function applyMaxSize(target, operation, errors, ownerName) {
  if (!isPlainObject(target) || target.size === undefined) {
    return target;
  }

  if (!Array.isArray(target.size)) {
    errors.push(formatCopyError(`_copy ${ownerName}: maxSize requires array field "size"`));
    return target;
  }

  const maxSize = String(operation.max ?? "").trim().toUpperCase();
  const maxIndex = SIZE_ORDER.indexOf(maxSize);
  if (maxIndex === -1) {
    errors.push(formatCopyError(`_copy ${ownerName}: invalid maxSize value "${String(operation.max ?? "")}"`));
    return target;
  }

  return {
    ...target,
    size: target.size.map((size) => {
      const normalized = String(size ?? "").trim().toUpperCase();
      const currentIndex = SIZE_ORDER.indexOf(normalized);

      if (currentIndex === -1 || currentIndex <= maxIndex) {
        return size;
      }

      return maxSize;
    })
  };
}

function applyScalarMultXp(target, operation, errors, ownerName) {
  if (!isPlainObject(target) || target.cr === undefined) {
    return target;
  }

  const scalar = Number(operation.scalar);
  if (!Number.isFinite(scalar)) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarMultXp requires numeric "scalar"`));
    return target;
  }

  const floor = Boolean(operation.floor);

  if (isPlainObject(target.cr)) {
    const nextCr = { ...target.cr };

    const baseXp = nextCr.xp ?? getDefaultXpForCrValue(nextCr.cr);
    if (baseXp !== null && baseXp !== undefined) {
      const scaledXp = scaleNumber(baseXp, scalar, floor);
      if (scaledXp !== null) {
        nextCr.xp = scaledXp;
      }
    }

    const lairXp = nextCr.xpLair ?? getDefaultXpForCrValue(nextCr.lair);
    if (lairXp !== null && lairXp !== undefined) {
      const scaledLairXp = scaleNumber(lairXp, scalar, floor);
      if (scaledLairXp !== null) {
        nextCr.xpLair = scaledLairXp;
      }
    }

    return {
      ...target,
      cr: nextCr
    };
  }

  const baseXp = getDefaultXpForCrValue(target.cr);
  if (baseXp === null) {
    return target;
  }

  const scaledXp = scaleNumber(baseXp, scalar, floor);
  if (scaledXp === null) {
    return target;
  }

  return {
    ...target,
    cr: {
      cr: String(target.cr),
      xp: scaledXp
    }
  };
}

function applyScalarMultProp(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || target[pathKey] === undefined) {
    return target;
  }

  if (!isPlainObject(target[pathKey])) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarMultProp requires object field "${pathKey}"`));
    return target;
  }

  const propSegments = normalizePropPath(operation.prop);
  if (propSegments.length === 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarMultProp requires "prop"`));
    return target;
  }

  const scalar = Number(operation.scalar);
  if (!Number.isFinite(scalar)) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarMultProp requires numeric "scalar"`));
    return target;
  }

  const currentValue = getNestedProp(target[pathKey], propSegments);
  const scaledValue = scaleNumber(currentValue, scalar, Boolean(operation.floor));
  if (scaledValue === null) {
    return target;
  }

  return {
    ...target,
    [pathKey]: setNestedProp(target[pathKey], propSegments, scaledValue)
  };
}

function applyPrefixSuffixStringProp(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || target[pathKey] === undefined) {
    return target;
  }

  if (!isPlainObject(target[pathKey])) {
    errors.push(formatCopyError(`_copy ${ownerName}: prefixSuffixStringProp requires object field "${pathKey}"`));
    return target;
  }

  const propSegments = normalizePropPath(operation.prop);
  if (propSegments.length === 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: prefixSuffixStringProp requires "prop"`));
    return target;
  }

  const currentValue = getNestedProp(target[pathKey], propSegments);
  if (typeof currentValue !== "string") {
    return target;
  }

  return {
    ...target,
    [pathKey]: setNestedProp(
      target[pathKey],
      propSegments,
      `${String(operation.prefix ?? "")}${currentValue}${String(operation.suffix ?? "")}`
    )
  };
}

function applyScalarAddProp(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || target[pathKey] === undefined) {
    return target;
  }

  if (!isPlainObject(target[pathKey])) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarAddProp requires object field "${pathKey}"`));
    return target;
  }

  const scalar = Number(operation.scalar);
  if (!Number.isFinite(scalar)) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarAddProp requires numeric "scalar"`));
    return target;
  }

  if (operation.prop === "*") {
    const nextObject = { ...target[pathKey] };

    for (const [propKey, propValue] of Object.entries(nextObject)) {
      const parsed = parseNumericLike(propValue);
      if (!parsed) {
        continue;
      }

      nextObject[propKey] = formatNumericLike(parsed, parsed.numeric + scalar);
    }

    return {
      ...target,
      [pathKey]: nextObject
    };
  }

  const propSegments = normalizePropPath(operation.prop);
  if (propSegments.length === 0) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarAddProp requires "prop"`));
    return target;
  }

  const parsed = parseNumericLike(getNestedProp(target[pathKey], propSegments));
  if (!parsed) {
    return target;
  }

  return {
    ...target,
    [pathKey]: setNestedProp(target[pathKey], propSegments, formatNumericLike(parsed, parsed.numeric + scalar))
  };
}

function applyScalarAddHit(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || target[pathKey] === undefined) {
    return target;
  }

  const scalar = Number(operation.scalar);
  if (!Number.isFinite(scalar)) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarAddHit requires numeric "scalar"`));
    return target;
  }

  return {
    ...target,
    [pathKey]: mapTextRecursive(target[pathKey], (text) => adjustHitBonusesInText(text, scalar))
  };
}

function applyScalarAddDc(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target) || target[pathKey] === undefined) {
    return target;
  }

  const scalar = Number(operation.scalar);
  if (!Number.isFinite(scalar)) {
    errors.push(formatCopyError(`_copy ${ownerName}: scalarAddDc requires numeric "scalar"`));
    return target;
  }

  return {
    ...target,
    [pathKey]: mapTextRecursive(target[pathKey], (text) => adjustDcsInText(text, scalar))
  };
}

function applyAppendIfNotExistsArr(target, pathKey, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: appendIfNotExistsArr requires object target for "${pathKey}"`));
    return target;
  }

  const targetArray =
    target[pathKey] === undefined
      ? []
      : Array.isArray(target[pathKey])
        ? target[pathKey]
        : null;

  if (!targetArray) {
    errors.push(formatCopyError(`_copy ${ownerName}: appendIfNotExistsArr requires array field "${pathKey}"`));
    return target;
  }

  if (operation.items === undefined) {
    errors.push(formatCopyError(`_copy ${ownerName}: appendIfNotExistsArr for "${pathKey}" requires "items"`));
    return target;
  }

  const itemsToAppend = Array.isArray(operation.items) ? cloneJson(operation.items) : [cloneJson(operation.items)];
  const nextArray = [...targetArray];

  for (const item of itemsToAppend) {
    if (!nextArray.some((existing) => isArrayEntryEquivalent(existing, item))) {
      nextArray.push(item);
    }
  }

  return {
    ...target,
    [pathKey]: nextArray
  };
}

function applyAddSenses(target, operation, errors, ownerName) {
  if (!isPlainObject(target)) {
    errors.push(formatCopyError(`_copy ${ownerName}: addSenses requires object target`));
    return target;
  }

  if (operation.senses === undefined) {
    errors.push(formatCopyError(`_copy ${ownerName}: addSenses requires "senses"`));
    return target;
  }

  const currentSenses = Array.isArray(target.senses) ? [...target.senses] : target.senses === undefined ? [] : null;
  if (!currentSenses) {
    errors.push(formatCopyError(`_copy ${ownerName}: addSenses requires array field "senses"`));
    return target;
  }

  const senseEntries = Array.isArray(operation.senses) ? operation.senses : [operation.senses];

  for (const sense of senseEntries) {
    const normalized = normalizeSenseEntry(sense);
    if (!normalized) {
      errors.push(formatCopyError(`_copy ${ownerName}: invalid sense entry in addSenses`));
      continue;
    }

    if (!currentSenses.some((existing) => isArrayEntryEquivalent(existing, normalized))) {
      currentSenses.push(normalized);
    }
  }

  return {
    ...target,
    senses: currentSenses
  };
}

function applyCopyMods(target, mods, errors, ownerName) {
  if (!isPlainObject(mods)) {
    return target;
  }

  let updated = target;
  const orderedEntries = [
    ...Object.entries(mods).filter(([pathKey]) => pathKey !== "*"),
    ...Object.entries(mods).filter(([pathKey]) => pathKey === "*")
  ];

  for (const [pathKey, rawOperations] of orderedEntries) {
    const operations = Array.isArray(rawOperations) ? rawOperations : [rawOperations];

    for (const operation of operations) {
      if (!isPlainObject(operation)) {
        errors.push(formatCopyError(`_copy ${ownerName}: invalid _mod entry for "${pathKey}"`));
        continue;
      }

      switch (operation.mode) {
        case "replaceTxt":
          updated = applyReplaceTxt(updated, pathKey, operation, errors, ownerName);
          break;
        case "replaceArr":
          updated = applyReplaceArr(updated, pathKey, operation, errors, ownerName);
          break;
        case "removeArr":
          updated = applyRemoveArr(updated, pathKey, operation, errors, ownerName);
          break;
        case "appendArr":
          updated = applyAppendArr(updated, pathKey, operation, errors, ownerName);
          break;
        case "prependArr":
          updated = applyPrependArr(updated, pathKey, operation, errors, ownerName);
          break;
        case "insertArr":
          updated = applyInsertArr(updated, pathKey, operation, errors, ownerName);
          break;
        case "addSkills":
          updated = applyAddSkills(updated, operation, errors, ownerName);
          break;
        case "setProp":
          updated = applySetProp(updated, operation, errors, ownerName);
          break;
        case "maxSize":
          updated = applyMaxSize(updated, operation, errors, ownerName);
          break;
        case "scalarMultXp":
          updated = applyScalarMultXp(updated, operation, errors, ownerName);
          break;
        case "scalarMultProp":
          updated = applyScalarMultProp(updated, pathKey, operation, errors, ownerName);
          break;
        case "prefixSuffixStringProp":
          updated = applyPrefixSuffixStringProp(updated, pathKey, operation, errors, ownerName);
          break;
        case "scalarAddProp":
          updated = applyScalarAddProp(updated, pathKey, operation, errors, ownerName);
          break;
        case "scalarAddHit":
          updated = applyScalarAddHit(updated, pathKey, operation, errors, ownerName);
          break;
        case "scalarAddDc":
          updated = applyScalarAddDc(updated, pathKey, operation, errors, ownerName);
          break;
        case "appendIfNotExistsArr":
          updated = applyAppendIfNotExistsArr(updated, pathKey, operation, errors, ownerName);
          break;
        case "addSenses":
          updated = applyAddSenses(updated, operation, errors, ownerName);
          break;
        default:
          errors.push(
            formatCopyError(`_copy ${ownerName}: unsupported mode "${String(operation.mode)}" for "${pathKey}"`)
          );
          break;
      }
    }
  }

  return updated;
}

function applyTemplate(target, template, errors, ownerName) {
  if (!isPlainObject(template)) {
    errors.push(formatCopyError(`_copy ${ownerName}: invalid template definition`));
    return target;
  }

  const applyBlock = isPlainObject(template.apply) ? template.apply : null;
  if (!applyBlock) {
    errors.push(formatCopyError(`_copy ${ownerName}: template "${String(template.name ?? "unknown")}" missing apply block`));
    return target;
  }

  let updated = target;

  if (applyBlock._root !== undefined) {
    if (isPlainObject(applyBlock._root)) {
      updated = deepMerge(updated, applyBlock._root);
    } else {
      errors.push(
        formatCopyError(`_copy ${ownerName}: template "${String(template.name ?? "unknown")}" has invalid _root block`)
      );
    }
  }

  if (applyBlock._mod !== undefined) {
    if (isPlainObject(applyBlock._mod)) {
      updated = applyCopyMods(updated, applyBlock._mod, errors, ownerName);
    } else {
      errors.push(
        formatCopyError(`_copy ${ownerName}: template "${String(template.name ?? "unknown")}" has invalid _mod block`)
      );
    }
  }

  return updated;
}

function applyTemplates(target, templateRefs, templatesByName, errors, ownerName) {
  if (!Array.isArray(templateRefs)) {
    errors.push(formatCopyError(`_copy ${ownerName}: invalid _templates block`));
    return target;
  }

  let updated = target;

  for (const templateRef of templateRefs) {
    const templateName =
      typeof templateRef === "string"
        ? templateRef
        : isPlainObject(templateRef) && templateRef.name
          ? String(templateRef.name)
          : "";

    if (!templateName) {
      errors.push(formatCopyError(`_copy ${ownerName}: invalid template reference`));
      continue;
    }

    const template = templatesByName.get(templateName);
    if (!template) {
      errors.push(formatCopyError(`_copy ${ownerName}: template "${templateName}" not found`));
      continue;
    }

    if (Array.isArray(template._copyError)) {
      errors.push(...template._copyError.map((message) => formatCopyError(String(message))));
      continue;
    }

    const canonicalTemplateName = String(template.name ?? templateName);

    if (!SUPPORTED_TEMPLATE_NAMES.has(canonicalTemplateName)) {
      errors.push(formatCopyError(`_copy ${ownerName}: template "${templateName}" not supported yet`));
      continue;
    }

    updated = applyTemplate(updated, template, errors, ownerName);
  }

  return updated;
}

function getTemplateNames(templateRefs) {
  if (!Array.isArray(templateRefs)) {
    return [];
  }

  return templateRefs
    .map((templateRef) =>
      typeof templateRef === "string"
        ? templateRef
        : isPlainObject(templateRef) && templateRef.name
          ? String(templateRef.name)
          : ""
    )
    .filter(Boolean);
}

function resolveTemplateDefinition(rawTemplate, templatesByName, resolvedCache, stack = []) {
  if (!isPlainObject(rawTemplate)) {
    return cloneJson(rawTemplate);
  }

  const cacheKey = rawTemplate.name ? `template:${String(rawTemplate.name)}` : `template:${JSON.stringify(rawTemplate)}`;
  if (resolvedCache.has(cacheKey)) {
    return cloneJson(resolvedCache.get(cacheKey));
  }

  const ownerName = rawTemplate.name ? String(rawTemplate.name) : "unknown template";
  if (stack.includes(ownerName)) {
    return {
      ...cloneJson(rawTemplate),
      _copyError: [`_copy ${ownerName}: circular template copy detected`]
    };
  }

  const hasCopyMeta = rawTemplate._copy !== undefined;
  const copyMeta = isPlainObject(rawTemplate._copy) ? rawTemplate._copy : null;
  let resolved = {};
  const errors = [];

  if (hasCopyMeta && !copyMeta) {
    errors.push(formatCopyError(`_copy ${ownerName}: invalid _copy block`));
  }

  if (copyMeta) {
    const unsupportedCopyKeys = Object.keys(copyMeta).filter(
      (key) => key !== "name" && key !== "_mod" && key !== "_preserve"
    );
    for (const key of unsupportedCopyKeys) {
      errors.push(formatCopyError(`_copy ${ownerName}: unsupported key "${key}"`));
    }

    if (!copyMeta.name) {
      errors.push(formatCopyError(`_copy ${ownerName}: missing source name`));
    } else {
      const sourceTemplate = templatesByName.get(String(copyMeta.name));

      if (!sourceTemplate) {
        errors.push(formatCopyError(`_copy ${ownerName}: source "${String(copyMeta.name)}" not found`));
      } else {
        resolved = resolveTemplateDefinition(sourceTemplate, templatesByName, resolvedCache, [...stack, ownerName]);
      }
    }

    if (copyMeta._mod !== undefined) {
      if (isPlainObject(copyMeta._mod)) {
        resolved = applyCopyMods(resolved, copyMeta._mod, errors, ownerName);
      } else {
        errors.push(formatCopyError(`_copy ${ownerName}: invalid _mod block`));
      }
    }
  }

  const overrides = cloneJson(rawTemplate);
  delete overrides._copy;

  const merged = deepMerge(resolved, overrides);
  const inheritedErrors = Array.isArray(merged._copyError) ? merged._copyError.map((entry) => String(entry)) : [];
  const allErrors = inheritedErrors.concat(errors);

  if (allErrors.length > 0) {
    merged._copyError = allErrors;
  } else {
    delete merged._copyError;
  }

  resolvedCache.set(cacheKey, cloneJson(merged));
  return merged;
}

function resolveMonster(rawMonster, monstersByName, templatesByName, resolvedCache, stack = []) {
  if (!isPlainObject(rawMonster)) {
    return cloneJson(rawMonster);
  }

  const cacheKey = rawMonster.name ? String(rawMonster.name) : JSON.stringify(rawMonster);
  if (resolvedCache.has(cacheKey)) {
    return cloneJson(resolvedCache.get(cacheKey));
  }

  const ownerName = rawMonster.name ? String(rawMonster.name) : "unknown monster";
  if (stack.includes(ownerName)) {
    return {
      ...cloneJson(rawMonster),
      _copyError: [`_copy ${ownerName}: circular copy detected`]
    };
  }

  const hasCopyMeta = rawMonster._copy !== undefined;
  const copyMeta = isPlainObject(rawMonster._copy) ? rawMonster._copy : null;
  let resolved = {};
  const errors = [];
  let appliedTemplateNames = [];

  if (hasCopyMeta && !copyMeta) {
    errors.push(formatCopyError(`_copy ${ownerName}: invalid _copy block`));
  }

  if (copyMeta) {
    const unsupportedCopyKeys = Object.keys(copyMeta).filter((key) => key !== "name" && key !== "_mod" && key !== "_templates");
    for (const key of unsupportedCopyKeys) {
      errors.push(formatCopyError(`_copy ${ownerName}: unsupported key "${key}"`));
    }

    if (!copyMeta.name) {
      errors.push(formatCopyError(`_copy ${ownerName}: missing source name`));
    } else {
      const sourceMonster = monstersByName.get(String(copyMeta.name));

      if (!sourceMonster) {
        errors.push(formatCopyError(`_copy ${ownerName}: source "${String(copyMeta.name)}" not found`));
      } else {
        resolved = resolveMonster(sourceMonster, monstersByName, templatesByName, resolvedCache, [...stack, ownerName]);
      }
    }

    if (copyMeta._templates !== undefined) {
      appliedTemplateNames = getTemplateNames(copyMeta._templates);
      resolved = applyTemplates(resolved, copyMeta._templates, templatesByName, errors, ownerName);
    }

    if (copyMeta._mod !== undefined) {
      if (isPlainObject(copyMeta._mod)) {
        resolved = applyCopyMods(resolved, copyMeta._mod, errors, ownerName);
      } else {
        errors.push(formatCopyError(`_copy ${ownerName}: invalid _mod block`));
      }
    }
  }

  const overrides = cloneJson(rawMonster);
  delete overrides._copy;

  let merged = deepMerge(resolved, overrides);
  if (hasTemplatePlaceholders(merged)) {
    merged = resolveTemplatePlaceholders(merged, merged);
  }

  const inheritedTemplateNames = Array.isArray(merged._appliedTemplates)
    ? merged._appliedTemplates.map((entry) => String(entry)).filter(Boolean)
    : [];
  const allTemplateNames = [...new Set([...inheritedTemplateNames, ...appliedTemplateNames])];
  if (allTemplateNames.length > 0) {
    merged._appliedTemplates = allTemplateNames;
  } else {
    delete merged._appliedTemplates;
  }

  const inheritedErrors = Array.isArray(merged._copyError)
    ? merged._copyError.map((entry) => String(entry))
    : [];
  const allErrors = inheritedErrors.concat(errors);

  if (allErrors.length > 0) {
    merged._copyError = allErrors;
  } else {
    delete merged._copyError;
  }

  resolvedCache.set(cacheKey, cloneJson(merged));
  return merged;
}

function resolveCopies(monsters, templates = []) {
  const monstersByName = new Map();
  for (const monster of monsters) {
    if (isPlainObject(monster) && monster.name) {
      monstersByName.set(String(monster.name), monster);
    }
  }

  const rawTemplatesByName = new Map();
  for (const template of templates) {
    if (isPlainObject(template) && template.name) {
      rawTemplatesByName.set(String(template.name), template);
    }
  }

  const resolvedTemplateCache = new Map();
  const resolvedTemplates = templates.map((template) =>
    resolveTemplateDefinition(template, rawTemplatesByName, resolvedTemplateCache)
  );

  const templatesByName = new Map();
  for (const template of resolvedTemplates) {
    if (isPlainObject(template) && template.name) {
      templatesByName.set(String(template.name), template);
      if (Array.isArray(template.alias)) {
        for (const alias of template.alias) {
          if (typeof alias === "string" && alias.trim()) {
            templatesByName.set(alias, template);
          }
        }
      }
    }
  }

  const resolvedCache = new Map();
  return monsters.map((monster) => resolveMonster(monster, monstersByName, templatesByName, resolvedCache));
}

async function loadMonsters() {
  const dataset = await readMonsterJsonDataset();
  const signature = dataset?.signature ?? "dataset:unknown";

  if (monstersCache.signature === signature && monstersCache.data) {
    if (!monstersCache.byExactName) {
      const index = new Map();
      for (const monster of monstersCache.data) {
        const key = normalizeTokenText(monster?.name).toLowerCase();
        if (key && !index.has(key)) {
          index.set(key, monster);
        }
      }
      monstersCache.byExactName = index;
    }
    return monstersCache.data;
  }

  if (pendingLoad?.signature === signature) {
    return pendingLoad.promise;
  }

  const promise = Promise.resolve()
    .then(() => {
      const parsedMonsters = Array.isArray(dataset?.monsters) ? dataset.monsters : [];
      const parsedTemplates = Array.isArray(dataset?.templates) ? dataset.templates : [];
      const data = resolveCopies(parsedMonsters, parsedTemplates);
      const byExactName = new Map();
      for (const monster of data) {
        const key = normalizeTokenText(monster?.name).toLowerCase();
        if (key && !byExactName.has(key)) {
          byExactName.set(key, monster);
        }
      }

      monstersCache = {
        data,
        signature,
        byExactName
      };

      return data;
    })
    .catch(() => monstersCache.data ?? [])
    .finally(() => {
      if (pendingLoad?.signature === signature) {
        pendingLoad = null;
      }
    });

  pendingLoad = {
    signature,
    promise
  };

  return promise;
}

const COMPARISON_OPERATORS = new Set(["gt", "gte", "lt", "lte", "eq", "neq"]);
const SIZE_LABELS_BY_CODE = {
  T: "tiny",
  S: "small",
  M: "medium",
  L: "large",
  H: "huge",
  G: "gargantuan"
};
const ALIGNMENT_CODES = {
  l: "lawful",
  n: "neutral",
  c: "chaotic",
  g: "good",
  e: "evil",
  u: "unaligned",
  a: "any"
};

function normalizeFilterString(value) {
  return String(value ?? "").trim();
}

function getFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeFilterString(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeComparisonOperator(value) {
  const normalized = normalizeFilterString(value).toLowerCase();
  return COMPARISON_OPERATORS.has(normalized) ? normalized : "gte";
}

function parseNumericFilterValue(value) {
  const normalized = normalizeFilterString(value).replace(",", ".");
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCrFilterValue(value) {
  const normalized = normalizeFilterString(value);
  return normalized ? parseCrNumber(normalized) : null;
}

function extractFirstNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    const numeric = Number(match[0]);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function getAcNumber(monster) {
  const ac = monster?.ac;

  if (typeof ac === "number") {
    return ac;
  }

  if (typeof ac === "string") {
    return extractFirstNumber(ac);
  }

  if (isPlainObject(ac)) {
    if (ac.ac !== undefined) {
      return extractFirstNumber(ac.ac);
    }

    if (ac.special) {
      return extractFirstNumber(ac.special);
    }
  }

  if (Array.isArray(ac)) {
    for (const entry of ac) {
      if (typeof entry === "number") {
        return entry;
      }

      if (typeof entry === "string") {
        const numeric = extractFirstNumber(entry);
        if (numeric !== null) {
          return numeric;
        }
      }

      if (isPlainObject(entry)) {
        if (entry.ac !== undefined) {
          const numeric = extractFirstNumber(entry.ac);
          if (numeric !== null) {
            return numeric;
          }
        }

        if (entry.special) {
          const numeric = extractFirstNumber(entry.special);
          if (numeric !== null) {
            return numeric;
          }
        }
      }
    }
  }

  return null;
}

function getHpNumber(monster) {
  const hp = monster?.hp;

  if (typeof hp === "number") {
    return hp;
  }

  if (typeof hp === "string") {
    return extractFirstNumber(hp);
  }

  if (isPlainObject(hp)) {
    if (hp.average !== undefined) {
      return extractFirstNumber(hp.average);
    }

    if (hp.special) {
      return extractFirstNumber(hp.special);
    }
  }

  return null;
}

function getSpeedValueNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return extractFirstNumber(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const numeric = getSpeedValueNumber(item);
      if (numeric !== null) {
        return numeric;
      }
    }

    return null;
  }

  if (isPlainObject(value)) {
    if (value.number !== undefined) {
      return extractFirstNumber(value.number);
    }

    return extractFirstNumber(JSON.stringify(value));
  }

  return null;
}

function getSpeedNumber(monster) {
  const speed = monster?.speed;

  if (!isPlainObject(speed)) {
    return getSpeedValueNumber(speed);
  }

  if (speed.walk !== undefined) {
    const walk = getSpeedValueNumber(speed.walk);
    if (walk !== null) {
      return walk;
    }
  }

  for (const [key, value] of Object.entries(speed)) {
    if (key === "walk" || key === "alternate" || key === "canHover") {
      continue;
    }

    const numeric = getSpeedValueNumber(value);
    if (numeric !== null) {
      return numeric;
    }
  }

  if (isPlainObject(speed.alternate)) {
    for (const value of Object.values(speed.alternate)) {
      const numeric = getSpeedValueNumber(value);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  return null;
}

function getPassivePerceptionNumber(monster) {
  return parseNumericFilterValue(monster?.passive);
}

function flattenText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenText(item)).filter(Boolean).join(" ");
  }

  if (isPlainObject(value)) {
    return Object.values(value)
      .map((item) => flattenText(item))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function getTypeText(monster) {
  const typeValue = monster?.type;

  if (typeValue === null || typeValue === undefined) {
    return "";
  }

  if (typeof typeValue === "string") {
    return typeValue;
  }

  if (!isPlainObject(typeValue)) {
    return flattenText(typeValue);
  }

  const baseType = typeValue.type ? String(typeValue.type) : "";
  const tags = Array.isArray(typeValue.tags)
    ? typeValue.tags
        .map((tag) => {
          if (typeof tag === "string") {
            return tag;
          }

          if (isPlainObject(tag)) {
            if (tag.tag) {
              return tag.prefix ? `${tag.prefix} ${tag.tag}` : String(tag.tag);
            }

            return flattenText(tag);
          }

          return "";
        })
        .filter(Boolean)
    : [];

  return [baseType, ...tags].filter(Boolean).join(" ");
}

function getTagsText(monster) {
  const tags = [];

  if (monster?.tag !== undefined) {
    tags.push(flattenText(monster.tag));
  }

  if (isPlainObject(monster?.type) && Array.isArray(monster.type.tags)) {
    tags.push(
      monster.type.tags
        .map((tag) => {
          if (typeof tag === "string") {
            return tag;
          }

          if (isPlainObject(tag) && tag.tag) {
            return tag.prefix ? `${tag.prefix} ${tag.tag}` : String(tag.tag);
          }

          return flattenText(tag);
        })
        .filter(Boolean)
        .join(" ")
    );
  }

  return tags.filter(Boolean).join(" ");
}

function getGroupText(monster) {
  return flattenText(monster?.group);
}

function mapAlignmentToken(token) {
  const normalized = String(token ?? "").trim().toLowerCase();
  return ALIGNMENT_CODES[normalized] || normalized;
}

function formatAlignmentText(alignmentValue) {
  if (alignmentValue === null || alignmentValue === undefined) {
    return "";
  }

  if (typeof alignmentValue === "string") {
    return mapAlignmentToken(alignmentValue);
  }

  if (Array.isArray(alignmentValue)) {
    return alignmentValue.map((item) => formatAlignmentText(item)).filter(Boolean).join(" ");
  }

  if (isPlainObject(alignmentValue)) {
    if (Array.isArray(alignmentValue.alignment)) {
      const base = alignmentValue.alignment.map((item) => mapAlignmentToken(item)).join(" ");
      const chance = alignmentValue.chance ? ` ${alignmentValue.chance}%` : "";
      return `${base}${chance}`.trim();
    }

    return flattenText(alignmentValue);
  }

  return "";
}

function getSizeText(monster) {
  const sizeValue = monster?.size;

  if (sizeValue === null || sizeValue === undefined) {
    return "";
  }

  const tokens = Array.isArray(sizeValue) ? sizeValue : [sizeValue];

  return tokens
    .map((token) => {
      const code = String(token ?? "").trim().toUpperCase();
      if (!code) {
        return "";
      }

      const label = SIZE_LABELS_BY_CODE[code];
      return label ? `${code} ${label}` : code;
    })
    .filter(Boolean)
    .join(" ");
}

function includesInsensitive(value, query) {
  if (!query) {
    return true;
  }

  return String(value ?? "").toLowerCase().includes(query.toLowerCase());
}

function compareNumbers(left, operator, right) {
  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    default:
      return left >= right;
  }
}

function matchesNumericFilter(value, filter) {
  if (filter.value === null) {
    return true;
  }

  if (!Number.isFinite(value)) {
    return false;
  }

  return compareNumbers(value, filter.op, filter.value);
}

function normalizeFilters(rawFilters) {
  const source = isPlainObject(rawFilters) ? rawFilters : {};
  const q = getFirstNonEmpty(source.q, source.search);
  const name = normalizeFilterString(source.name);
  const alias = normalizeFilterString(source.alias);
  const tags = getFirstNonEmpty(source.tags, source.tag);
  const size = normalizeFilterString(source.size);
  const alignment = getFirstNonEmpty(source.alignment, source.neutralidad, source.neutrality);
  const trait = getFirstNonEmpty(source.trait, source.traits);
  const action = getFirstNonEmpty(source.action, source.actions);
  const type = normalizeFilterString(source.type);

  return {
    q,
    name,
    alias,
    tags,
    size,
    alignment,
    trait,
    action,
    type,
    ac: {
      op: normalizeComparisonOperator(getFirstNonEmpty(source.acOp, source.caOp)),
      value: parseNumericFilterValue(getFirstNonEmpty(source.ac, source.ca))
    },
    hp: {
      op: normalizeComparisonOperator(getFirstNonEmpty(source.hpOp, source.vidaOp)),
      value: parseNumericFilterValue(getFirstNonEmpty(source.hp, source.vida))
    },
    speed: {
      op: normalizeComparisonOperator(getFirstNonEmpty(source.speedOp, source.spreedOp)),
      value: parseNumericFilterValue(getFirstNonEmpty(source.speed, source.spreed))
    },
    pp: {
      op: normalizeComparisonOperator(getFirstNonEmpty(source.ppOp, source.passiveOp)),
      value: parseNumericFilterValue(getFirstNonEmpty(source.pp, source.passive))
    },
    cr: {
      op: normalizeComparisonOperator(source.crOp),
      value: parseCrFilterValue(source.cr)
    }
  };
}

function hasAnyActiveFilter(rawFilters) {
  if (!isPlainObject(rawFilters)) {
    return false;
  }

  return Object.entries(rawFilters).some(([key, value]) => {
    if (key === "offset" || key === "limit") {
      return false;
    }

    return String(value ?? "").trim() !== "";
  });
}

function filterMonsters(monsters, filters) {
  return monsters.filter((monster) => {
    const nameText = flattenText(monster?.name);
    const aliasText = flattenText(monster?.alias);
    const typeText = getTypeText(monster);
    const groupText = getGroupText(monster);
    const tagsText = getTagsText(monster);
    const sizeText = getSizeText(monster);
    const alignmentText = formatAlignmentText(monster?.alignment);
    const traitsText = flattenText(monster?.trait);
    const actionsText = flattenText(monster?.action);
    const globalSearch = [
      nameText,
      aliasText,
      typeText,
      groupText,
      tagsText
    ]
      .filter(Boolean)
      .join(" ");

    if (!includesInsensitive(globalSearch, filters.q)) {
      return false;
    }

    if (!includesInsensitive(nameText, filters.name)) {
      return false;
    }

    if (!includesInsensitive(aliasText, filters.alias)) {
      return false;
    }

    if (!includesInsensitive(tagsText, filters.tags)) {
      return false;
    }

    if (!includesInsensitive(sizeText, filters.size)) {
      return false;
    }

    if (!includesInsensitive(alignmentText, filters.alignment)) {
      return false;
    }

    if (!includesInsensitive(traitsText, filters.trait)) {
      return false;
    }

    if (!includesInsensitive(actionsText, filters.action)) {
      return false;
    }

    if (!includesInsensitive(typeText, filters.type)) {
      return false;
    }

    if (!matchesNumericFilter(getAcNumber(monster), filters.ac)) {
      return false;
    }

    if (!matchesNumericFilter(getHpNumber(monster), filters.hp)) {
      return false;
    }

    if (!matchesNumericFilter(getSpeedNumber(monster), filters.speed)) {
      return false;
    }

    if (!matchesNumericFilter(getPassivePerceptionNumber(monster), filters.pp)) {
      return false;
    }

    if (!matchesNumericFilter(getMonsterCrNumber(monster), filters.cr)) {
      return false;
    }

    return true;
  });
}

export async function prefetchMissingMonsterTokens(limitInput = 8, requestContext = null) {
  const monsters = await loadMonsters();
  const requestedLimit = normalizeNumber(limitInput, 8);
  const limit = Math.min(Math.max(requestedLimit, 1), 50);

  let scanned = 0;
  let attempted = 0;
  let downloaded = 0;

  for (const monster of monsters) {
    if (!isMonsterTokenCandidate(monster)) {
      continue;
    }

    scanned += 1;
    if (attempted >= limit) {
      break;
    }

    attempted += 1;
    const downloadedImage = await ensureMonsterTokenImage(monster, requestContext);
    if (downloadedImage) {
      downloaded += 1;
    }
  }

  return {
    scanned,
    attempted,
    downloaded,
    limit
  };
}

function shouldIncludeMonsterTokenImage(options) {
  if (!isPlainObject(options)) {
    return true;
  }

  return options.withTokenImage !== false;
}

function resolveMonsterSortField(options) {
  if (!isPlainObject(options)) {
    return "name";
  }

  return options.sortField === "type" || options.sortField === "cr" ? options.sortField : "name";
}

function resolveMonsterSortDirection(options) {
  if (!isPlainObject(options)) {
    return "asc";
  }

  return options.sortDirection === "desc" ? "desc" : "asc";
}

function compareMonsterByName(left, right) {
  return String(left?.name ?? "").localeCompare(String(right?.name ?? ""), "en", {
    sensitivity: "base"
  });
}

function compareMonsterByType(left, right) {
  const difference = getTypeText(left).localeCompare(getTypeText(right), "en", {
    sensitivity: "base"
  });

  return difference || compareMonsterByName(left, right);
}

function compareMonsterByCr(left, right) {
  const leftCr = getMonsterCrNumber(left);
  const rightCr = getMonsterCrNumber(right);

  if (leftCr === null && rightCr === null) {
    return compareMonsterByName(left, right);
  }

  if (leftCr === null) {
    return 1;
  }

  if (rightCr === null) {
    return -1;
  }

  const difference = leftCr - rightCr;
  return difference || compareMonsterByName(left, right);
}

function sortMonsters(monsters, options) {
  const sortField = resolveMonsterSortField(options);
  const sortDirection = resolveMonsterSortDirection(options);
  const directionMultiplier = sortDirection === "desc" ? -1 : 1;
  const sortedMonsters = [...monsters];

  sortedMonsters.sort((left, right) => {
    let difference = 0;

    if (sortField === "type") {
      difference = compareMonsterByType(left, right);
    } else if (sortField === "cr") {
      difference = compareMonsterByCr(left, right);
    } else {
      difference = compareMonsterByName(left, right);
    }

    return difference * directionMultiplier;
  });

  return sortedMonsters;
}

export async function getMonsterBatch(offsetInput, limitInput, rawFilters = null, requestContext = null, options = null) {
  const monsters = await loadMonsters();
  const filters = normalizeFilters(rawFilters);
  const filteredMonsters = filterMonsters(monsters, filters);
  const sortedMonsters = sortMonsters(filteredMonsters, options);
  const total = sortedMonsters.length;
  const offset = normalizeNumber(offsetInput, 0);
  const requestedLimit = normalizeNumber(limitInput, 6);
  const withTokenImage = shouldIncludeMonsterTokenImage(options);
  const maxLimit = withTokenImage ? 24 : 5000;
  const limit = Math.min(Math.max(requestedLimit, 1), maxLimit);
  const slicedMonsters = sortedMonsters.slice(offset, offset + limit);
  const items = withTokenImage
    ? await Promise.all(slicedMonsters.map((monster) => enrichMonsterWithTokenImage(monster, requestContext)))
    : slicedMonsters;
  const nextOffset = offset + items.length;

  return {
    hasMore: nextOffset < total,
    items,
    nextOffset,
    total
  };
}

export async function getMonsterByExactName(nameInput, requestContext = null, options = null) {
  const target = String(nameInput ?? "").trim().toLowerCase();
  if (!target) {
    return null;
  }

  await loadMonsters();
  const foundMonster = monstersCache.byExactName?.get(target) ?? null;

  if (!foundMonster) {
    return null;
  }

  if (shouldIncludeMonsterTokenImage(options)) {
    return enrichMonsterWithTokenImage(foundMonster, requestContext);
  }

  return foundMonster;
}
