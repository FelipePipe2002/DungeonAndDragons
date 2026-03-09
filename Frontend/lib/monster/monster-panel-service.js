const KNOWN_KEYS = new Set([
  "name",
  "alias",
  "isNamedCreature",
  "summonedBySpell",
  "summonedBySpellLevel",
  "summonedByClass",
  "size",
  "group",
  "type",
  "alignment",
  "alignmentPrefix",
  "ac",
  "hp",
  "speed",
  "senses",
  "passive",
  "immune",
  "resist",
  "vulnerable",
  "languages",
  "treasure",
  "skill",
  "save",
  "trait",
  "action",
  "spellcasting",
  "bonus",
  "reaction",
  "reactionHeader",
  "legendary",
  "legendaryActions",
  "legendaryActionsLair",
  "legendaryGroup",
  "legendaryHeader",
  "mythic",
  "mythicHeader",
  "dragonAge",
  "initiative",
  "gear",
  "attachedItems",
  "cr",
  "source",
  "hasToken",
  "image",
  "_copy",
  "_copyError",
  "_appliedTemplates",
  "conditionImmune",
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha"
]);
const ALERT_IGNORED_KEYS = new Set(["summonedBySpell"]);
const SIZE_LABELS = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan"
};
const XP_BY_CR = {
  "0": "0 or 10",
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatInlineValue(value) {
  if (value === null || value === undefined) {
    return "Sin datos";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Sin datos";
    }

    return value.map((item) => formatInlineValue(item)).join(", ");
  }

  return JSON.stringify(value);
}

function formatNaturalList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatSizeValue(size) {
  const formatPart = (value) => {
    const normalized = String(value ?? "").trim().toUpperCase();
    return SIZE_LABELS[normalized] || String(value);
  };

  if (size === null || size === undefined || size === "") {
    return "";
  }

  if (Array.isArray(size)) {
    const entries = size
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value) => formatPart(value));

    return entries.length > 0 ? formatNaturalList(entries) : "";
  }

  return formatPart(size);
}

function capitalizeFirst(text) {
  if (!text) {
    return "";
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function formatDefenseValue(value, defenseKey) {
  if (value === null || value === undefined) {
    return "";
  }

  if (isPlainObject(value) && value.special) {
    return String(value.special);
  }

  const formatDefenseEntry = (entry) => {
    if (entry === null || entry === undefined) {
      return "";
    }

    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      return capitalizeFirst(cleanInlineText(entry));
    }

    if (isPlainObject(entry)) {
      if (entry.special) {
        return cleanInlineText(entry.special);
      }

      const defenseValues = Array.isArray(entry[defenseKey])
        ? entry[defenseKey].map((item) => capitalizeFirst(cleanInlineText(item))).filter(Boolean)
        : [];
      const defenseText = formatNaturalList(defenseValues);
      const noteText = entry.note ? cleanInlineText(entry.note) : "";

      if (defenseText && noteText) {
        return `${defenseText} ${noteText}`;
      }

      if (defenseText) {
        return defenseText;
      }
    }

    return "";
  };

  if (Array.isArray(value)) {
    const simpleEntries = [];
    const groupedEntries = [];

    for (const entry of value) {
      const text = formatDefenseEntry(entry);
      if (!text) {
        continue;
      }

      if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
        simpleEntries.push(text);
      } else {
        groupedEntries.push(text);
      }
    }

    const entries = [
      simpleEntries.length > 0 ? formatNaturalList(simpleEntries) : "",
      ...groupedEntries
    ].filter(Boolean);

    if (entries.length > 0) {
      return entries.join("; ");
    }
  }

  if (isPlainObject(value)) {
    const entryText = formatDefenseEntry(value);
    if (entryText) {
      return entryText;
    }
  }

  return formatInlineValue(value);
}

function formatResistValue(value) {
  return formatDefenseValue(value, "resist");
}

function formatImmuneValue(value) {
  return formatDefenseValue(value, "immune");
}

function formatCombinedImmuneValue(monster) {
  const immuneText = monster?.immune !== undefined ? formatImmuneValue(monster.immune) : "";
  const conditionText =
    monster?.conditionImmune !== undefined ? formatInlineValue(monster.conditionImmune) : "";

  return [immuneText, conditionText].filter(Boolean).join("; ");
}

function formatCreatureType(typeValue) {
  if (!typeValue) {
    return { text: "", fallback: false };
  }

  if (typeof typeValue === "string") {
    return { text: typeValue, fallback: false };
  }

  if (isPlainObject(typeValue)) {
    const baseType = typeValue.type ? String(typeValue.type) : "";
    const tags = Array.isArray(typeValue.tags)
      ? typeValue.tags
          .map((tag) => {
            if (typeof tag === "string") {
              return tag;
            }

            if (isPlainObject(tag) && tag.tag) {
              const baseTag = String(tag.tag);
              const prefix = tag.prefix ? String(tag.prefix) : "";
              const suffix = tag.suffix ? String(tag.suffix) : "";
              const prefixText = prefix && !tag.prefixHidden ? `${prefix} ` : "";
              const suffixText = suffix && !tag.suffixHidden ? ` ${suffix}` : "";
              return `${prefixText}${baseTag}${suffixText}`.trim();
            }

            return String(tag);
          })
          .filter(Boolean)
      : [];

    if (baseType && tags.length > 0) {
      return { text: `${baseType} (${tags.join(", ")})`, fallback: false };
    }

    if (baseType) {
      return { text: baseType, fallback: false };
    }

    return { text: formatInlineValue(typeValue), fallback: true };
  }

  return { text: formatInlineValue(typeValue), fallback: true };
}

function formatMultilineValue(value) {
  if (value === null || value === undefined) {
    return "Sin datos";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function formatArmorClass(ac) {
  if (ac === undefined) {
    return "";
  }

  if (isPlainObject(ac) && ac.special) {
    return String(ac.special);
  }

  if (!Array.isArray(ac)) {
    return formatInlineValue(ac);
  }

  return ac
    .map((entry) => {
      if (typeof entry === "number" || typeof entry === "string") {
        return String(entry);
      }

      if (isPlainObject(entry) && entry.special) {
        return String(entry.special);
      }

      if (isPlainObject(entry) && entry.ac !== undefined) {
        const from = entry.from ? ` (${formatInlineValue(entry.from)})` : "";
        const condition = entry.condition ? ` ${entry.condition}` : "";
        return `${entry.ac}${from}${condition}`;
      }

      return formatInlineValue(entry);
    })
    .join(", ");
}

function formatHp(hp) {
  if (hp === undefined) {
    return "";
  }

  if (isPlainObject(hp)) {
    if (hp.special) {
      return String(hp.special);
    }

    const average = hp.average;
    const formula = hp.formula;

    if (average !== undefined && formula) {
      return `${average} (${formula})`;
    }

    if (average !== undefined) {
      return String(average);
    }
  }

  return formatInlineValue(hp);
}

function extractPrimaryNumber(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  const match = text.match(/-?\d+(?:\/\d+)?(?:\.\d+)?/);
  return match ? match[0] : text;
}

function formatArmorClassCompact(ac) {
  if (ac === undefined) {
    return "";
  }

  if (isPlainObject(ac) && ac.ac !== undefined) {
    return String(ac.ac);
  }

  if (isPlainObject(ac) && ac.special) {
    return cleanInlineText(ac.special);
  }

  if (Array.isArray(ac)) {
    for (const entry of ac) {
      if (typeof entry === "number" || typeof entry === "string") {
        return extractPrimaryNumber(entry);
      }

      if (isPlainObject(entry) && entry.ac !== undefined) {
        return String(entry.ac);
      }

      if (isPlainObject(entry) && entry.special) {
        return cleanInlineText(entry.special);
      }
    }
  }

  return extractPrimaryNumber(formatArmorClass(ac));
}

function formatHpCompact(hp) {
  if (hp === undefined) {
    return "";
  }

  if (typeof hp === "number") {
    return String(hp);
  }

  if (typeof hp === "string") {
    return extractPrimaryNumber(hp);
  }

  if (isPlainObject(hp)) {
    if (hp.average !== undefined) {
      return String(hp.average);
    }

    if (hp.special) {
      return cleanInlineText(hp.special);
    }
  }

  return extractPrimaryNumber(formatHp(hp));
}

function formatSpeedDistance(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return extractPrimaryNumber(value);
  }

  if (isPlainObject(value) && value.number !== undefined) {
    return String(value.number);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = formatSpeedDistance(entry);
      if (text) {
        return text;
      }
    }

    return "";
  }

  return extractPrimaryNumber(formatInlineValue(value));
}

function formatSpeedCompact(speed) {
  if (speed === undefined) {
    return "";
  }

  if (!isPlainObject(speed)) {
    return formatSpeedDistance(speed);
  }

  const movementKeys = Object.keys(speed).filter((key) => key !== "alternate" && key !== "canHover");
  const prioritizedKeys = movementKeys.includes("walk")
    ? ["walk", ...movementKeys.filter((key) => key !== "walk")]
    : movementKeys;

  for (const key of prioritizedKeys) {
    const text = formatSpeedDistance(speed[key]);
    if (text) {
      return text;
    }
  }

  if (isPlainObject(speed.alternate)) {
    for (const value of Object.values(speed.alternate)) {
      const text = formatSpeedDistance(value);
      if (text) {
        return text;
      }
    }
  }

  return extractPrimaryNumber(formatSpeed(speed));
}

function formatSpeedEntry(mode, value, options = {}) {
  const { hideWalkLabel = false } = options;
  const prefix = mode === "walk" && hideWalkLabel ? "" : `${mode} `;

  if (typeof value === "number" || typeof value === "string") {
    return `${prefix}${value} ft.`.trim();
  }

  if (isPlainObject(value) && value.number !== undefined) {
    const condition = value.condition ? ` ${value.condition}` : "";
    return `${prefix}${value.number} ft.${condition}`.trim();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatSpeedEntry(mode, entry)).join(", ");
  }

  return `${mode} ${formatInlineValue(value)}`.trim();
}

function formatAlternateSpeed(alternate) {
  if (!isPlainObject(alternate)) {
    return formatInlineValue(alternate);
  }

  const entries = Object.entries(alternate).flatMap(([mode, value]) => {
    if (Array.isArray(value)) {
      return value.map((entry) => formatSpeedEntry(mode, entry));
    }

    return [formatSpeedEntry(mode, value)];
  });

  return entries.filter(Boolean).join(", ");
}

function formatSpeed(speed) {
  if (speed === undefined) {
    return "";
  }

  if (!isPlainObject(speed)) {
    return formatInlineValue(speed);
  }

  const parts = [];
  const movementKeys = Object.keys(speed).filter((key) => key !== "alternate" && key !== "canHover");
  const showWalkLabel = movementKeys.some((key) => key !== "walk");

  for (const key of movementKeys) {
    const segment = formatSpeedEntry(key, speed[key], {
      hideWalkLabel: key === "walk" && !showWalkLabel
    });

    if (segment) {
      parts.push(segment);
    }
  }

  if (speed.alternate) {
    const alternate = formatAlternateSpeed(speed.alternate);

    if (alternate) {
      parts.push(`alternate: ${alternate}`);
    }
  }

  if (speed.canHover) {
    parts.push("can hover");
  }

  return parts.length > 0 ? parts.join(", ") : "Sin datos";
}

function formatSkills(skill) {
  if (!isPlainObject(skill)) {
    return "";
  }

  const entries = Object.entries(skill)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name} ${formatInlineValue(value)}`.trim());

  return entries.length > 0 ? entries.join(", ") : "";
}

function formatAlignment(monster) {
  const alignment = monster?.alignment;
  if (!alignment) {
    return "";
  }

  const map = {
    l: "Lawful",
    n: "Neutral",
    c: "Chaotic",
    g: "Good",
    e: "Evil",
    u: "Unaligned"
  };

  const formatPart = (value) => {
    const key = String(value).toLowerCase();
    return map[key] || String(value);
  };

  const alignmentText = Array.isArray(alignment)
    ? alignment.map((value) => formatPart(value)).join(" ")
    : formatPart(alignment);

  if (!alignmentText) {
    return "";
  }

  const prefix = monster?.alignmentPrefix;
  if (!prefix) {
    return alignmentText;
  }

  return prefix.endsWith(" ") ? `${prefix}${alignmentText}` : `${prefix} ${alignmentText}`;
}

function formatRechargeText(value) {
  if (!value) {
    return "(Recharge 6)";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `(Recharge ${value})`;
  }

  if (numeric >= 6) {
    return "(Recharge 6)";
  }

  return `(Recharge ${numeric}-${6})`;
}

function replaceKnownInlineTags(text) {
  return String(text)
    .replace(/\{@recharge(?:\s+(\d+))?\}/gi, (_, value) => formatRechargeText(value))
    .replace(/\{@recharge(?:\s+(\d+))?$/gi, (_, value) => formatRechargeText(value))
    .replace(/\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1")
    .replace(/\{@\w+\s+([^}|\n]+)(?:\|[^}\n]*)?$/g, "$1");
}

export function cleanInlineText(text) {
  if (!text) {
    return "";
  }

  return replaceKnownInlineTags(text)
    .replace(/}\b/g, "")
    .replace(/\s*DC:\s*/g, "DC ")
    .trim();
}

export function containsAlertMarker(text) {
  if (text === null || text === undefined) {
    return false;
  }

  const normalized = replaceKnownInlineTags(text);
  return /xphb/i.test(String(text)) || /[{}@|]/.test(normalized);
}

function formatAbilityLabel(ability) {
  const map = {
    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma"
  };

  if (!ability) {
    return "";
  }

  const key = String(ability).toLowerCase();
  return map[key] || String(ability);
}

function formatSpellEntry(spell) {
  if (spell === null || spell === undefined) {
    return "";
  }

  if (isPlainObject(spell)) {
    if (spell.hidden) {
      return "";
    }

    if (spell.entry) {
      return cleanInlineText(spell.entry);
    }

    if (spell.name) {
      return cleanInlineText(spell.name);
    }

    return cleanInlineText(formatInlineValue(spell));
  }

  return cleanInlineText(spell);
}

function formatSpellList(list) {
  if (!Array.isArray(list)) {
    return "";
  }

  const entries = list.map((spell) => formatSpellEntry(spell)).filter(Boolean);
  return entries.length > 0 ? entries.join(", ") : "";
}

function isSpellcastingEntry(entry) {
  if (!isPlainObject(entry)) {
    return false;
  }

  return (
    entry.type === "spellcasting" ||
    Array.isArray(entry.headerEntries) ||
    Array.isArray(entry.footerEntries) ||
    Array.isArray(entry.will) ||
    isPlainObject(entry.daily) ||
    isPlainObject(entry.spells) ||
    entry.ability !== undefined
  );
}

function splitSpellcastingByDisplayAs(spellcasting) {
  const groups = {
    standalone: [],
    action: [],
    bonus: [],
    reaction: [],
    legendary: []
  };

  if (!Array.isArray(spellcasting)) {
    return groups;
  }

  for (const item of spellcasting) {
    const displayAs = item?.displayAs;
    if (displayAs === "action") {
      groups.action.push(item);
      continue;
    }

    if (displayAs === "bonus") {
      groups.bonus.push(item);
      continue;
    }

    if (displayAs === "reaction") {
      groups.reaction.push(item);
      continue;
    }

    if (displayAs === "legendary") {
      groups.legendary.push(item);
      continue;
    }

    groups.standalone.push(item);
  }

  return groups;
}

function formatSpellLevelLabel(level) {
  const numeric = Number(level);

  if (!Number.isFinite(numeric)) {
    return `${level} level`;
  }

  if (numeric === 0) {
    return "Cantrips";
  }

  if (numeric === 1) {
    return "1st level";
  }

  if (numeric === 2) {
    return "2nd level";
  }

  if (numeric === 3) {
    return "3rd level";
  }

  return `${numeric}th level`;
}

function formatPreparedSpellGroups(spells) {
  if (!isPlainObject(spells)) {
    return [];
  }

  return Object.entries(spells).map(([level, spellGroup]) => {
    if (Array.isArray(spellGroup)) {
      return {
        key: level,
        label: formatSpellLevelLabel(level),
        list: formatSpellList(spellGroup),
        fallback: false
      };
    }

    if (isPlainObject(spellGroup)) {
      const list = formatSpellList(spellGroup.spells);
      const slots = spellGroup.slots;
      const slotLabel =
        slots === undefined || slots === null || slots === ""
          ? formatSpellLevelLabel(level)
          : `${formatSpellLevelLabel(level)} (${slots} ${Number(slots) === 1 ? "slot" : "slots"})`;

      return {
        key: level,
        label: slotLabel,
        list,
        fallback: !Array.isArray(spellGroup.spells)
      };
    }

    return {
      key: level,
      label: formatSpellLevelLabel(level),
      list: "",
      fallback: true
    };
  });
}

function isPrimitiveEntryValue(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function formatEntryLabel(name, suffix = ".") {
  const text = cleanInlineText(name);
  if (!text) {
    return "";
  }

  return /[.:!?]$/.test(text) ? text : `${text}${suffix}`;
}

function normalizeEntry(entry) {
  if (entry === null || entry === undefined) {
    return [];
  }

  if (isPrimitiveEntryValue(entry)) {
    return [{ kind: "text", text: entry }];
  }

  if (Array.isArray(entry)) {
    return entry.flatMap((item) => normalizeEntry(item));
  }

  if (isPlainObject(entry)) {
    if (entry.type === "list" && Array.isArray(entry.items)) {
      return [
        {
          kind: "list",
          items: entry.items.flatMap((item) => normalizeEntry(item))
        }
      ];
    }

    if (entry.type === "itemSub") {
      const inlineEntry = isPrimitiveEntryValue(entry.entry) ? entry.entry : null;
      const entries = Array.isArray(entry.entries) ? entry.entries : [];
      const singleInlineEntry =
        !inlineEntry && entries.length === 1 && isPrimitiveEntryValue(entries[0]) ? entries[0] : null;
      const nestedEntries = inlineEntry || singleInlineEntry ? [] : entries;

      return [
        {
          kind: "itemSub",
          name: entry.name ? formatEntryLabel(entry.name) : "",
          inlineText: inlineEntry || singleInlineEntry || "",
          entryItems:
            !inlineEntry && !singleInlineEntry && entry.entry !== undefined
              ? normalizeEntry(entry.entry)
              : [],
          items: nestedEntries.flatMap((item) => normalizeEntry(item))
        }
      ];
    }

    if (entry.type === "item") {
      return [
        {
          kind: "item",
          name: entry.name ? cleanInlineText(entry.name) : "",
          items: Array.isArray(entry.entries) ? entry.entries.flatMap((item) => normalizeEntry(item)) : []
        }
      ];
    }

    if (Array.isArray(entry.entries)) {
      return entry.entries.flatMap((item) => normalizeEntry(item));
    }
  }

  return [{ kind: "fallback", text: formatInlineValue(entry) }];
}

function createEntriesCard(title, entries) {
  const normalizedEntries = normalizeEntry(entries);

  if (!title && normalizedEntries.length === 0) {
    return null;
  }

  return {
    kind: "entries",
    title,
    entries: normalizedEntries
  };
}

function createLinesCard(title, lines) {
  const normalizedLines = lines.filter(Boolean);

  if (!title && normalizedLines.length === 0) {
    return null;
  }

  return {
    kind: "lines",
    title,
    lines: normalizedLines
  };
}

function buildSpellcastingCard(spellcasting) {
  if (!isPlainObject(spellcasting)) {
    return createEntriesCard("Spellcasting", spellcasting);
  }

  const title = spellcasting.name ? cleanInlineText(spellcasting.name) : "Spellcasting";
  const headerEntries = Array.isArray(spellcasting.headerEntries) ? spellcasting.headerEntries : [];
  const footerEntries = Array.isArray(spellcasting.footerEntries) ? spellcasting.footerEntries : [];
  const willList = formatSpellList(spellcasting.will);
  const daily = isPlainObject(spellcasting.daily) ? spellcasting.daily : null;
  const spells = formatPreparedSpellGroups(spellcasting.spells);
  const ability = formatAbilityLabel(spellcasting.ability);
  const lines = [
    ...headerEntries.map((entry) => ({ kind: "text", text: entry })),
    ability && !headerEntries.length ? { kind: "text", text: `Spellcasting ability: ${ability}.` } : null,
    willList ? { kind: "labeled", label: "At will", text: willList } : null,
    ...(daily
      ? Object.entries(daily).flatMap(([frequency, dailySpells]) => {
          const list = formatSpellList(dailySpells);
          if (!list) {
            if (Array.isArray(dailySpells)) {
              return [];
            }

            return [{ kind: "fallback", text: formatInlineValue(dailySpells) }];
          }

          const label = frequency.endsWith("e")
            ? `${frequency.replace(/e$/, "")}/day each`
            : `${frequency}/day`;

          return [{ kind: "labeled", label, text: list }];
        })
      : []),
    ...spells.flatMap((spellGroup) => {
      if (!spellGroup.list) {
        return spellGroup.fallback ? [{ kind: "fallback", text: spellGroup.label }] : [];
      }

      return [{ kind: "labeled", label: spellGroup.label, text: spellGroup.list }];
    }),
    ...footerEntries.map((entry) => ({ kind: "text", text: entry }))
  ];

  return createLinesCard(title, lines);
}

function hasFallbackInEntry(entry) {
  if (entry === null || entry === undefined) {
    return false;
  }

  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
    return false;
  }

  if (Array.isArray(entry)) {
    return entry.some((item) => hasFallbackInEntry(item));
  }

  if (isPlainObject(entry)) {
    if (entry.type === "list" && Array.isArray(entry.items)) {
      return entry.items.some((item) => hasFallbackInEntry(item));
    }

    if (entry.type === "itemSub") {
      if (entry.entry !== undefined) {
        return !isPrimitiveEntryValue(entry.entry) && hasFallbackInEntry(entry.entry);
      }

      if (Array.isArray(entry.entries)) {
        return entry.entries.some((item) => hasFallbackInEntry(item));
      }

      return false;
    }

    if (entry.type === "item") {
      if (Array.isArray(entry.entries)) {
        return entry.entries.some((item) => hasFallbackInEntry(item));
      }

      return false;
    }

    if (Array.isArray(entry.entries)) {
      return entry.entries.some((item) => hasFallbackInEntry(item));
    }

    return true;
  }

  return true;
}

function hasFallbackInSpellcasting(spellcasting) {
  if (!isPlainObject(spellcasting)) {
    return true;
  }

  if (spellcasting.headerEntries !== undefined && !Array.isArray(spellcasting.headerEntries)) {
    return true;
  }

  if (spellcasting.footerEntries !== undefined && !Array.isArray(spellcasting.footerEntries)) {
    return true;
  }

  if (spellcasting.will !== undefined && !Array.isArray(spellcasting.will)) {
    return true;
  }

  if (spellcasting.daily !== undefined) {
    if (!isPlainObject(spellcasting.daily)) {
      return true;
    }

    return Object.values(spellcasting.daily).some((value) => !Array.isArray(value));
  }

  if (spellcasting.spells !== undefined) {
    if (!isPlainObject(spellcasting.spells)) {
      return true;
    }

    return Object.values(spellcasting.spells).some((value) => {
      if (Array.isArray(value)) {
        return false;
      }

      if (isPlainObject(value)) {
        return !Array.isArray(value.spells);
      }

      return true;
    });
  }

  return false;
}

function hasFallbackInRenderableItem(item) {
  return isSpellcastingEntry(item) ? hasFallbackInSpellcasting(item) : hasFallbackInEntry(item?.entries ?? item);
}

function hasFallbackInRenderableList(items) {
  return Array.isArray(items) && items.some((item) => hasFallbackInRenderableItem(item));
}

function hasAlertText(value, ignoredKeys = null) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return containsAlertMarker(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasAlertText(item, ignoredKeys));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).some(([key, item]) => {
      if (ignoredKeys?.has(key)) {
        return false;
      }

      return hasAlertText(item, ignoredKeys);
    });
  }

  return false;
}

function formatLegendarySubject(monster) {
  const baseName = cleanInlineText(monster?.legendaryGroup?.name || monster?.name);
  if (!baseName) {
    return "the creature";
  }

  const lowerName = baseName.toLowerCase();
  if (/^(the|a|an)\b/.test(lowerName)) {
    return lowerName;
  }

  if (!monster?.legendaryGroup?.name && !baseName.includes(" ")) {
    return baseName;
  }

  return `the ${lowerName}`;
}

function capitalizeSentence(text) {
  if (!text) {
    return "";
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function formatLegendaryUses(monster) {
  const explicitUses = Number(monster?.legendaryActions);
  const lairUses = Number(monster?.legendaryActionsLair);

  const baseUses = Number.isFinite(explicitUses)
    ? explicitUses
    : Number.isFinite(lairUses)
      ? lairUses - 1
      : 3;

  if (Number.isFinite(lairUses)) {
    return `${baseUses} (${lairUses} in Lair)`;
  }

  return String(baseUses);
}

function formatSignedBonus(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  if (numeric === 0) {
    return "";
  }

  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function formatInitiative(initiative) {
  if (initiative === null || initiative === undefined) {
    return "";
  }

  if (typeof initiative === "number" || typeof initiative === "string") {
    return formatSignedBonus(initiative);
  }

  if (isPlainObject(initiative)) {
    const parts = [];

    if (initiative.proficiency !== undefined) {
      const proficiency = formatSignedBonus(initiative.proficiency);
      if (proficiency) {
        parts.push(proficiency);
      }
    }

    if (initiative.bonus !== undefined) {
      const bonus = formatSignedBonus(initiative.bonus);
      if (bonus) {
        parts.push(bonus);
      }
    }

    if (initiative.advantageMode === "adv") {
      parts.push("Advantage");
    } else if (initiative.advantageMode === "dis") {
      parts.push("Disadvantage");
    }

    return parts.join(" ");
  }

  return formatInlineValue(initiative);
}

function formatXpValue(xp) {
  if (xp === null || xp === undefined || xp === "") {
    return "";
  }

  if (typeof xp === "string") {
    return xp;
  }

  const numeric = Number(xp);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return numeric.toLocaleString("en-US");
}

function isMissingCrValue(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "" || normalized === "-" || normalized === "—" || normalized === "unknown";
  }

  return false;
}

function formatCr(crValue) {
  if (isMissingCrValue(crValue)) {
    return "Unknown";
  }

  if (typeof crValue === "string" || typeof crValue === "number") {
    const crText = String(crValue);
    const xp = formatXpValue(XP_BY_CR[crText]);
    return xp ? `CR ${crText} (XP ${xp})` : `CR ${crText}`;
  }

  if (isPlainObject(crValue)) {
    const baseCr = crValue.cr !== undefined ? String(crValue.cr) : "";
    if (!baseCr) {
      return "Unknown";
    }

    const baseXp = formatXpValue(crValue.xp ?? XP_BY_CR[baseCr]);
    let result = baseXp ? `CR ${baseCr} (XP ${baseXp}` : `CR ${baseCr}`;

    const lairCr = crValue.lair !== undefined ? String(crValue.lair) : "";
    const lairXp = formatXpValue(crValue.xpLair ?? (lairCr ? XP_BY_CR[lairCr] : undefined));
    if (lairXp) {
      result += baseXp ? `, or ${lairXp} in lair` : ` (XP ${lairXp} in lair`;
    }

    if (baseXp || lairXp) {
      result += ")";
    }

    return result;
  }

  const fallback = formatInlineValue(crValue);
  return fallback && fallback !== "Sin datos" && !isMissingCrValue(fallback) ? fallback : "Unknown";
}

function formatCrCompact(crValue) {
  if (isMissingCrValue(crValue)) {
    return "Unknown";
  }

  if (typeof crValue === "string" || typeof crValue === "number") {
    const value = String(crValue);
    return isMissingCrValue(value) ? "Unknown" : value;
  }

  if (isPlainObject(crValue)) {
    if (crValue.cr !== undefined && crValue.cr !== null && crValue.cr !== "") {
      return String(crValue.cr);
    }

    if (crValue.lair !== undefined && crValue.lair !== null && crValue.lair !== "") {
      return String(crValue.lair);
    }
  }

  const compact = extractPrimaryNumber(formatInlineValue(crValue));
  return compact && !isMissingCrValue(compact) ? compact : "Unknown";
}

function formatReferenceName(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    return formatInlineValue(value);
  }

  const [name] = value.split("|");
  return cleanInlineText(name);
}

function formatSummonedBySpell(spell, level) {
  const spellName = formatReferenceName(spell);
  if (!spellName) {
    return "";
  }

  if (level === null || level === undefined || level === "") {
    return spellName;
  }

  return `${spellName} (Level ${level})`;
}

function formatStatModifier(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "";
  }

  const modifier = Math.floor((numeric - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function formatSaveBonus(save, key, fallbackValue) {
  if (!isPlainObject(save) || !key) {
    return formatStatModifier(fallbackValue);
  }

  const raw = save[key];

  if (raw === undefined || raw === null || raw === "") {
    return formatStatModifier(fallbackValue);
  }

  return formatInlineValue(raw);
}

function getUnhandledRootEntries(monster) {
  return Object.entries(monster ?? {}).filter(([key]) => !KNOWN_KEYS.has(key));
}

function formatGearEntry(entry) {
  if (entry === null || entry === undefined) {
    return "";
  }

  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
    return cleanInlineText(entry);
  }

  if (isPlainObject(entry) && entry.item) {
    const itemName = cleanInlineText(entry.item);
    if (entry.quantity !== undefined && entry.quantity !== null) {
      return `${itemName} x${entry.quantity}`;
    }

    return itemName;
  }

  return formatInlineValue(entry);
}

function hasFallbackInGearEntry(entry) {
  if (entry === null || entry === undefined) {
    return false;
  }

  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
    return false;
  }

  if (isPlainObject(entry)) {
    if (entry.item && (entry.quantity === undefined || entry.quantity === null || typeof entry.quantity === "number")) {
      return false;
    }

    return true;
  }

  return true;
}

function buildAttachedItemsAction(attachedItems) {
  if (!Array.isArray(attachedItems) || attachedItems.length === 0) {
    return null;
  }

  return {
    name: "Attached Items",
    entries: attachedItems.map((item) => cleanInlineText(formatInlineValue(item))).filter(Boolean)
  };
}

function buildSection(key, title, className, cardClassName, cards) {
  const visibleCards = cards.filter(Boolean);

  if (visibleCards.length === 0) {
    return null;
  }

  return {
    key,
    title,
    className,
    cardClassName,
    cards: visibleCards
  };
}

function buildSpellcastingSection(spellcasting) {
  if (!Array.isArray(spellcasting) || spellcasting.length === 0) {
    return null;
  }

  const cards = spellcasting.map((item) => {
    if (!isPlainObject(item)) {
      return createEntriesCard("Spellcasting", item);
    }

    if (isSpellcastingEntry(item)) {
      return buildSpellcastingCard(item);
    }

    return createEntriesCard(item.name ? cleanInlineText(item.name) : "Spellcasting", item.entries ?? item);
  });

  return buildSection("spellcasting", "Spellcasting", "spellcasting-block", "action-card", cards);
}

function buildTraitsSection(traits) {
  if (!Array.isArray(traits) || traits.length === 0) {
    return null;
  }

  const cards = traits.map((item) => {
    if (!isPlainObject(item)) {
      return createEntriesCard("Trait", item);
    }

    const name = item.name ? cleanInlineText(item.name) : "";
    const entries = Array.isArray(item.entries) ? item.entries : [];
    const allPlain = entries.every(
      (entry) =>
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean"
    );

    if (allPlain) {
      if (entries.length === 0) {
        return createLinesCard(name, []);
      }

      return createLinesCard("", [
        {
          kind: "inlineTitleText",
          title: name,
          suffix: ":",
          text: entries.join(" ")
        }
      ]);
    }

    return createEntriesCard(name, entries);
  });

  return buildSection("traits", "Traits", "traits-block", "trait-card", cards);
}

function buildActionSection(items, options) {
  const {
    key,
    title,
    defaultCardTitle,
    headerLines = [],
    plainMode = "lines",
    inlineTitleSuffix = "."
  } = options;

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const cards = [
    createLinesCard(
      "",
      headerLines.map((text) => ({ kind: "text", text }))
    ),
    ...items.map((item) => {
      if (!isPlainObject(item)) {
        return createEntriesCard(defaultCardTitle, item);
      }

      if (isSpellcastingEntry(item)) {
        return buildSpellcastingCard(item);
      }

      const name = item.name ? cleanInlineText(item.name) : "";
      const entries = Array.isArray(item.entries) ? item.entries : [];
      const allPlain = entries.every(
        (entry) =>
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean"
      );

      if (allPlain) {
        if (plainMode === "joined") {
          return createLinesCard("", [
            {
              kind: "inlineTitleText",
              title: name,
              suffix: inlineTitleSuffix,
              text: entries.join(" ")
            }
          ]);
        }

        return createLinesCard(name, entries.map((entry) => ({ kind: "text", text: entry })));
      }

      return createEntriesCard(name, entries);
    })
  ];

  return buildSection(key, title, "actions-block", "action-card", cards);
}

function buildLegendarySection(monster, legendary) {
  if (!Array.isArray(legendary) || legendary.length === 0) {
    return null;
  }

  const headerEntries = Array.isArray(monster?.legendaryHeader) ? monster.legendaryHeader : [];
  const subject = formatLegendarySubject(monster);
  const uses = formatLegendaryUses(monster);
  const generatedHeader = `Legendary Action Uses: ${uses}. Immediately after another creature's turn, ${subject} can expend a use to take one of the following actions. ${capitalizeSentence(subject)} regains all expended uses at the start of each of its turns.`;

  return buildActionSection(legendary, {
    key: "legendary",
    title: "Legendary Actions",
    defaultCardTitle: "Legendary Action",
    headerLines: headerEntries.length > 0 ? headerEntries : [generatedHeader],
    plainMode: "joined",
    inlineTitleSuffix: "."
  });
}

function buildMythicSection(monster, mythic) {
  if (!Array.isArray(mythic) || mythic.length === 0) {
    return null;
  }

  const headerEntries = Array.isArray(monster?.mythicHeader) ? monster.mythicHeader : [];

  return buildActionSection(mythic, {
    key: "mythic",
    title: "Mythic Actions",
    defaultCardTitle: "Mythic Action",
    headerLines: headerEntries,
    plainMode: "joined",
    inlineTitleSuffix: "."
  });
}

function buildGearSection(gear) {
  if (!Array.isArray(gear) || gear.length === 0) {
    return null;
  }

  const lines = gear
    .map((item) => formatGearEntry(item))
    .filter(Boolean)
    .map((text) => ({ kind: "text", text }));

  if (lines.length === 0) {
    return null;
  }

  return buildSection("gear", "Gear", "actions-block", "action-card", [createLinesCard("", lines)]);
}

function buildStatsColumns(monster) {
  return [
    [
      ["STR", monster?.str, "str"],
      ["INT", monster?.int, "int"]
    ],
    [
      ["DEX", monster?.dex, "dex"],
      ["WIS", monster?.wis, "wis"]
    ],
    [
      ["CON", monster?.con, "con"],
      ["CHA", monster?.cha, "cha"]
    ]
  ]
    .map((column) => column.filter(([, value]) => value !== undefined))
    .filter((column) => column.length > 0)
    .map((column) =>
      column.map(([label, value, key]) => ({
        label,
        value,
        mod: formatStatModifier(value),
        save: formatSaveBonus(monster?.save, key, value)
      }))
    );
}

function buildExtraValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => !isPlainObject(item)))
  ) {
    return {
      kind: "inline",
      text: formatInlineValue(value)
    };
  }

  return {
    kind: "block",
    text: formatMultilineValue(value)
  };
}

function buildDetailsModel({
  monster,
  index,
  appliedTemplates,
  copyErrors,
  gearSection,
  summonedByClass,
  summonedBySpell
}) {
  const rows = [
    ["Alias", monster?.alias !== undefined ? formatInlineValue(monster.alias) : ""],
    ["Named Creature", monster?.isNamedCreature ? "Yes" : ""],
    ["Group", monster?.group !== undefined ? formatInlineValue(monster.group) : ""],
    ["Languages", monster?.languages !== undefined ? formatInlineValue(monster.languages) : ""],
    ["Treasure", monster?.treasure !== undefined ? formatInlineValue(monster.treasure) : ""],
    ["Templates", appliedTemplates.length > 0 ? appliedTemplates.join(", ") : ""],
    ["Summoned By Spell", summonedBySpell],
    ["Summoned By Class", summonedByClass],
    ["Dragon Age", monster?.dragonAge !== undefined ? formatInlineValue(monster.dragonAge) : ""],
    ["Skills", formatSkills(monster?.skill)]
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({ label, value }));
  const extras = getUnhandledRootEntries(monster).map(([key, value]) => ({
    key,
    ...buildExtraValue(value)
  }));
  const hasContent =
    rows.length > 0 || Boolean(gearSection) || copyErrors.length > 0 || extras.length > 0;

  return {
    id: `monster-details-${index}`,
    hasContent,
    rows,
    gearSection,
    copyErrors,
    extras
  };
}

export function buildMonsterPanelModel(monster, index) {
  const title = monster?.name || `Monstruo ${index + 1}`;
  const sizeText = formatSizeValue(monster?.size);
  const typeInfo = formatCreatureType(monster?.type);
  const alignment = formatAlignment(monster);
  const summonedBySpell = formatSummonedBySpell(monster?.summonedBySpell, monster?.summonedBySpellLevel);
  const summonedByClass =
    monster?.summonedByClass !== undefined ? formatInlineValue(monster.summonedByClass) : "";
  const appliedTemplates = Array.isArray(monster?._appliedTemplates)
    ? monster._appliedTemplates.filter(
        (entry) => entry !== null && entry !== undefined && String(entry).trim() !== ""
      )
    : [];
  const copyErrors = Array.isArray(monster?._copyError)
    ? monster._copyError.filter(
        (entry) => entry !== null && entry !== undefined && String(entry).trim() !== ""
      )
    : monster?._copyError
      ? [monster._copyError]
      : [];
  const hasCopyError = copyErrors.length > 0;
  const actionItems = Array.isArray(monster?.action) ? monster.action : [];
  const bonusItems = Array.isArray(monster?.bonus) ? monster.bonus : [];
  const reactionItems = Array.isArray(monster?.reaction) ? monster.reaction : [];
  const legendaryItems = Array.isArray(monster?.legendary) ? monster.legendary : [];
  const mythicItems = Array.isArray(monster?.mythic) ? monster.mythic : [];
  const gearItems = Array.isArray(monster?.gear) ? monster.gear : [];
  const attachedItemsAction = buildAttachedItemsAction(monster?.attachedItems);
  const spellcastingItems = Array.isArray(monster?.spellcasting) ? monster.spellcasting : [];
  const spellcastingGroups = splitSpellcastingByDisplayAs(spellcastingItems);
  const mergedActions = attachedItemsAction
    ? actionItems.concat(spellcastingGroups.action, attachedItemsAction)
    : actionItems.concat(spellcastingGroups.action);
  const mergedBonuses = bonusItems.concat(spellcastingGroups.bonus);
  const mergedReactions = reactionItems.concat(spellcastingGroups.reaction);
  const mergedLegendary = legendaryItems.concat(spellcastingGroups.legendary);
  const unhandledRootEntries = getUnhandledRootEntries(monster);
  const hasAlert =
    hasAlertText(monster, ALERT_IGNORED_KEYS) ||
    (summonedBySpell && hasAlertText(summonedBySpell));
  const hasError =
    typeInfo.fallback ||
    (Array.isArray(monster?.trait) &&
      monster.trait.some((item) => hasFallbackInEntry(item?.entries ?? item))) ||
    hasFallbackInRenderableList(mergedActions) ||
    hasFallbackInRenderableList(spellcastingGroups.standalone) ||
    hasFallbackInRenderableList(mergedBonuses) ||
    hasFallbackInRenderableList(mergedReactions) ||
    hasFallbackInRenderableList(mergedLegendary) ||
    hasFallbackInRenderableList(mythicItems) ||
    (Array.isArray(gearItems) && gearItems.some((item) => hasFallbackInGearEntry(item))) ||
    hasCopyError ||
    hasAlert ||
    unhandledRootEntries.length > 0;
  const gearSection = buildGearSection(gearItems);
  const details = buildDetailsModel({
    monster,
    index,
    appliedTemplates,
    copyErrors,
    gearSection,
    summonedByClass,
    summonedBySpell
  });
  const immuneText = formatCombinedImmuneValue(monster);
  const resistText = monster?.resist !== undefined ? formatResistValue(monster.resist) : "";
  const vulnerableText =
    monster?.vulnerable !== undefined ? formatInlineValue(monster.vulnerable) : "";
  const sensesText = monster?.senses !== undefined ? formatInlineValue(monster.senses) : "";
  const passiveText = monster?.passive !== undefined ? formatInlineValue(monster.passive) : "";
  const combatRows = [
    { label: "AC", value: monster?.ac !== undefined ? formatArmorClass(monster.ac) : "Sin datos" },
    { label: "HP", value: monster?.hp !== undefined ? formatHp(monster.hp) : "Sin datos" },
    { label: "SPD", value: monster?.speed !== undefined ? formatSpeed(monster.speed) : "Sin datos" },
    { label: "PP", value: passiveText || "Sin datos" },
    { label: "CR", value: formatCrCompact(monster?.cr) || "Unknown" }
  ];

  return {
    title,
    indexLabel: `#${index + 1}`,
    hasError,
    errorLabel: hasCopyError ? "ERROR: _copy" : "Needs Review",
    hasDetailsContent: details.hasContent,
    metaChips: [
      sizeText ? { text: sizeText, tone: "default" } : null,
      typeInfo.text ? { text: typeInfo.text, tone: typeInfo.fallback ? "alert" : "default" } : null,
      alignment ? { text: alignment, tone: "default" } : null
    ].filter(Boolean),
    summaryStats: [
      { label: "AC", value: formatArmorClassCompact(monster?.ac) },
      { label: "HP", value: formatHpCompact(monster?.hp) },
      { label: "SPD", value: formatSpeedCompact(monster?.speed) },
      { label: "PP", value: passiveText },
      { label: "CR", value: formatCrCompact(monster?.cr) || "Unknown" }
    ].filter((item) => Boolean(item.value)),
    combatRows,
    statsColumns: buildStatsColumns(monster),
    bands: [
      { label: "Senses", value: sensesText, tone: "neutral" },
      { label: "Immune", value: immuneText, tone: "danger" },
      { label: "Resist", value: resistText, tone: "warn" },
      { label: "Vulnerable", value: vulnerableText, tone: "danger" }
    ].filter((item) => Boolean(item.value)),
    sections: [
      buildSpellcastingSection(spellcastingGroups.standalone),
      buildTraitsSection(monster?.trait),
      buildActionSection(mergedActions, {
        key: "actions",
        title: "Actions",
        defaultCardTitle: "Action",
        plainMode: "joined",
        inlineTitleSuffix: ":"
      }),
      buildActionSection(mergedBonuses, {
        key: "bonus",
        title: "Bonus Actions",
        defaultCardTitle: "Bonus Action"
      }),
      buildActionSection(mergedReactions, {
        key: "reaction",
        title: "Reaction",
        defaultCardTitle: "Reaction",
        headerLines: Array.isArray(monster?.reactionHeader) ? monster.reactionHeader : [],
        plainMode: "joined",
        inlineTitleSuffix: ":"
      }),
      buildLegendarySection(monster, mergedLegendary),
      buildMythicSection(monster, mythicItems)
    ].filter(Boolean),
    details
  };
}
