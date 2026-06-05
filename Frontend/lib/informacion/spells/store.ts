export interface SpellEntryLine {
	name?: string;
	text: string;
}

export interface Spell {
	name: string;
	source?: string;
	level: number | null;
	levelLabel: string;
	schoolCode: string;
	schoolLabel: string;
	isRitual: boolean;
	castingTime: string;
	castingTimeLabel: string;
	range: string;
	components: string;
	duration: string;
	description: SpellEntryLine[];
	higherLevel: SpellEntryLine[];
	damageTypes: string[];
	savingThrows: string[];
}

type JsonObject = Record<string, unknown>;

const SCHOOL_LABELS: Record<string, string> = {
	A: "Abjuration",
	C: "Conjuration",
	D: "Divination",
	E: "Enchantment",
	I: "Illusion",
	N: "Necromancy",
	T: "Transmutation",
	V: "Evocation",
};

export const SPELLS_JSON_URL = "/dataset/spells.json";

function _isObject (value: unknown): value is JsonObject {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function _capitalize (value: string): string {
	if (!value) return value;
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function _titleCase (value: string): string {
	return value
		.split(/\s+/g)
		.filter(Boolean)
		.map(_capitalize)
		.join(" ");
}

function _formatInlineTag (rawTag: string): string {
	const spaceIdx = rawTag.indexOf(" ");
	if (spaceIdx < 0) return rawTag;

	const body = rawTag.slice(spaceIdx + 1).trim();
	if (!body) return "";

	const parts = body.split("|").map(it => it.trim());
	return parts[2] || parts[0] || "";
}

function _cleanText (value: string): string {
	return value
		.replace(/\{@([^}]+)\}/g, (_m, tagBody: string) => _formatInlineTag(tagBody))
		.replace(/\s+/g, " ")
		.trim();
}

function _extractSpells (payload: unknown): unknown[] {
	if (Array.isArray(payload)) return payload;
	if (_isObject(payload) && Array.isArray(payload.spell)) return payload.spell;
	throw new Error("Formato JSON invalido: se esperaba [] o { spell: [] }");
}

function _formatLevelLabel (level: number | null): string {
	if (level == null) return "Level ?";
	return level === 0 ? "Cantrip" : `Level ${level}`;
}

function _formatSchool (value: unknown): {code: string; label: string} {
	if (typeof value !== "string" || !value.trim()) {
		return {code: "", label: "Unknown"};
	}

	const code = value.trim().toUpperCase();
	return {
		code,
		label: SCHOOL_LABELS[code] ?? code,
	};
}

function _formatCastingTime (value: unknown): string {
	if (!Array.isArray(value)) return "-";

	const parts = value
		.map(item => {
			if (!_isObject(item)) return "";

			const amount = typeof item.number === "number" ? String(item.number) : "";
			const unit = typeof item.unit === "string" ? item.unit : "";
			const condition = typeof item.condition === "string" ? _cleanText(item.condition) : "";
			const base = [amount, unit].filter(Boolean).join(" ");

			if (!base && !condition) return "";
			if (!condition) return base;
			if (!base) return condition;
			return `${base} (${condition})`;
		})
		.filter(Boolean);

	return parts.length ? parts.join(" / ") : "-";
}

function _formatRange (value: unknown): string {
	if (!_isObject(value)) return "-";

	const distance = _isObject(value.distance) ? value.distance : null;
	const amount = distance && typeof distance.amount === "number" ? distance.amount : null;
	const distanceType = distance && typeof distance.type === "string" ? distance.type : "";
	const type = typeof value.type === "string" ? value.type : "";

	if (amount != null && distanceType) return `${amount} ${distanceType}`;
	if (distanceType) return _titleCase(distanceType);
	if (type) return _titleCase(type);

	return "-";
}

function _formatComponents (value: unknown): string {
	if (!_isObject(value)) return "-";

	const parts: string[] = [];
	if (value.v === true) parts.push("V");
	if (value.s === true) parts.push("S");

	if ("m" in value) {
		const material = value.m;
		if (typeof material === "string") {
			parts.push(`M (${_cleanText(material)})`);
		} else if (_isObject(material)) {
			const text = typeof material.text === "string" ? _cleanText(material.text) : "";
			parts.push(text ? `M (${text})` : "M");
		} else if (material === true) {
			parts.push("M");
		}
	}

	return parts.length ? parts.join(", ") : "-";
}

function _formatDurationItem (value: unknown): string {
	if (!_isObject(value) || typeof value.type !== "string") return "";

	if (value.type === "instant") return "Instantaneous";
	if (value.type === "special") return "Special";

	if (value.type === "timed") {
		const duration = _isObject(value.duration) ? value.duration : null;
		const amount = duration && typeof duration.amount === "number" ? duration.amount : null;
		const kind = duration && typeof duration.type === "string" ? duration.type : "";

		const body = amount != null && kind
			? `${amount} ${kind}${amount === 1 ? "" : "s"}`
			: kind
				? _titleCase(kind)
				: "";

		if (!body) return "Timed";
		return value.concentration === true ? `Concentration, up to ${body}` : body;
	}

	return _titleCase(value.type);
}

function _formatDuration (value: unknown): string {
	if (!Array.isArray(value)) return "-";
	const parts = value.map(_formatDurationItem).filter(Boolean);
	return parts.length ? parts.join(" / ") : "-";
}

function _collectEntries (value: unknown, out: SpellEntryLine[]): void {
	if (typeof value === "string") {
		const cleaned = _cleanText(value);
		if (cleaned) out.push({text: cleaned});
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) _collectEntries(item, out);
		return;
	}

	if (_isObject(value) && "entries" in value) {
		const nested: SpellEntryLine[] = [];
		_collectEntries(value.entries, nested);
		if (!nested.length) return;

		if (typeof value.name === "string" && value.name.trim()) {
			const label = _cleanText(value.name);
			out.push({
				name: label,
				text: nested[0].text,
			});
			out.push(...nested.slice(1));
			return;
		}
		out.push(...nested);
	}
}

function _formatEntries (value: unknown): SpellEntryLine[] {
	const lines: SpellEntryLine[] = [];
	_collectEntries(value, lines);
	return lines;
}

function _formatStringList (value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(item => typeof item === "string" ? _titleCase(item) : "")
		.filter(Boolean);
}

function _isRitual (value: unknown): boolean {
	if (!_isObject(value)) return false;
	return value.ritual === true;
}

function _normalizeSpell (row: unknown): Spell | null {
	if (!_isObject(row)) return null;
	if (typeof row.name !== "string" || !row.name.trim()) return null;

	const level = typeof row.level === "number" ? row.level : null;
	const school = _formatSchool(row.school);
	const castingTime = _formatCastingTime(row.time);
	const isRitual = _isRitual(row.meta);

	return {
		name: row.name.trim(),
		source: typeof row.source === "string" ? row.source : undefined,
		level,
		levelLabel: _formatLevelLabel(level),
		schoolCode: school.code,
		schoolLabel: school.label,
		isRitual,
		castingTime,
		castingTimeLabel: isRitual ? `${castingTime} or Ritual` : castingTime,
		range: _formatRange(row.range),
		components: _formatComponents(row.components),
		duration: _formatDuration(row.duration),
		description: _formatEntries(row.entries),
		higherLevel: _formatEntries(row.entriesHigherLevel),
		damageTypes: _formatStringList(row.damageInflict),
		savingThrows: _formatStringList(row.savingThrow),
	};
}

export async function loadSpells (
	url: string = SPELLS_JSON_URL,
	fetcher: typeof fetch = fetch,
): Promise<Spell[]> {
	const res = await fetcher(url);
	if (!res.ok) {
		throw new Error(`No se pudo leer ${url} (${res.status})`);
	}

	const payload = await res.json();
	const rows = _extractSpells(payload);
	return rows
		.map(_normalizeSpell)
		.filter((spell): spell is Spell => spell !== null);
}
