#!/usr/bin/env python3
"""Translate text-bearing JSON fields through a local Ollama model."""

from __future__ import annotations

import argparse
import json
import re
import socket
from pathlib import Path
from typing import Any
from urllib import error, request


GENERIC_SKIP_KEYS = {
    "id",
    "_id",
    "uid",
    "uuid",
    "slug",
    "key",
    "code",
    "page",
    "source",
    "sources",
    "url",
    "uri",
    "href",
    "path",
    "file",
    "filename",
    "extension",
    "mime",
    "mimetype",
    "hash",
    "checksum",
    "version",
    "locale",
    "lang",
}

METADATA_SUFFIXES = (
    "id",
    "ids",
    "uuid",
    "slug",
    "key",
    "code",
    "url",
    "uri",
    "path",
    "file",
    "filename",
    "hash",
    "checksum",
)

CAMEL_CASE_PATTERN = re.compile(r"^[a-z]+(?:[A-Z][a-z0-9]+)+$")
UPPER_CODE_PATTERN = re.compile(r"^[A-Z0-9]{2,}(?:[-_/][A-Z0-9]+)*$")
NUMERIC_PATTERN = re.compile(r"^[+-]?\d+(?:[.,]\d+)?(?:\s?(?:%|ft\.?|feet|m|km|mi|lb|lbs|kg))?\.?$", re.IGNORECASE)
FORMULA_PATTERN = re.compile(r"^[\d\s+\-*/xXdD(),.:]+$")
IDENTIFIER_WITH_SYMBOLS_PATTERN = re.compile(r"^[A-Za-z0-9_.:/#-]+$")

DEFAULT_PROMPT_PREFIX = (
    "Traduci al espanol rioplatense. Devolve solo la traduccion, sin "
    "explicacion, sin etiquetas y sin comillas extra. Conserva placeholders, "
    "nombres propios y formato cuando corresponda. Si no hace falta traducir "
    "el texto, devolvelo exactamente igual. Texto: "
)

DND_CONTEXT = (
    "This is a Dungeon & Dragons JSON, so take that into account when translating. "
    "If you see a weird name with no direct Spanish translation, do not translate it. "
    "If it has an established Spanish translation, translate it."
)


class BatchResponseError(Exception):
    """Raised when a batch response cannot be parsed reliably."""


class OllamaRequestError(Exception):
    """Raised when an Ollama request fails and can be retried."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read a JSON file, translate user-facing text values with a local "
            "Ollama model, and write a translated copy."
        )
    )
    parser.add_argument("input_json", type=Path, help="Path to the source JSON file")
    parser.add_argument(
        "--output",
        type=Path,
        help="Path for the translated JSON. Default: <input>_es.json",
    )
    parser.add_argument(
        "-m",
        "--model",
        default="qwen2.5-coder:7b",
        help="Ollama model name (default: qwen2.5-coder:7b)",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:11434/api/generate",
        help="Ollama generate endpoint (default: http://localhost:11434/api/generate)",
    )
    parser.add_argument(
        "--prompt-prefix",
        default=DEFAULT_PROMPT_PREFIX,
        help="Instruction prefix sent before each text value",
    )
    parser.add_argument(
        "--context",
        default="",
        help="Additional translation context appended to the prompt for domain-specific guidance",
    )
    parser.add_argument(
        "--dnd-context",
        action="store_true",
        help="Append built-in Dungeon & Dragons translation guidance to the prompt",
    )
    parser.add_argument(
        "--mode",
        choices=("auto", "legacy-keys"),
        default="auto",
        help=(
            "Translation selection strategy: 'auto' translates any string that "
            "looks like user-facing text, while 'legacy-keys' uses the old "
            "hard-coded key allowlist behavior"
        ),
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="HTTP timeout in seconds for each Ollama request (default: 120)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Number of unique strings to send per Ollama request (default: 20)",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=2,
        help="Extra retry attempts per request before fallback (default: 2)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the input file instead of creating a new one",
    )
    parser.add_argument(
        "--checkpoint",
        type=Path,
        help="Path for resumable translation progress. Default: <output>.checkpoint.json",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each translated string while processing",
    )
    parser.add_argument(
        "--show-keys",
        action="store_true",
        help="Print which keys are translated or skipped and exit",
    )
    return parser.parse_args()


def print_key_rules() -> None:
    print("auto mode:")
    print("  translates any non-empty string that looks like human-readable text")
    print("  skips obvious ids, urls, file paths, formulas, numeric-only values, and metadata keys")
    print("  this is the default and works across different JSON schemas")

    print("legacy skipped metadata keys:")
    for key in sorted(GENERIC_SKIP_KEYS):
        print(f"  {key}")

    print("legacy-keys mode:")
    print("  keeps the previous hard-coded behavior for older workflows")


def legacy_should_translate_string(parent_key: str | None, value: str) -> bool:
    text = value.strip()
    if not text:
        return False

    if parent_key in {
        "source",
        "sources",
        "page",
        "srd",
        "srd52",
        "basicRules",
        "basicRules2024",
        "id",
        "_id",
        "uid",
        "tag",
        "tags",
        "type",
        "category",
        "ability",
        "abilities",
        "condition",
        "conditions",
        "mode",
        "from",
        "choose",
        "count",
        "amount",
        "level",
    }:
        return False

    return parent_key in {
        "name",
        "entries",
        "entry",
        "headerEntries",
        "footerEntries",
        "fluff",
        "note",
        "notes",
        "text",
        "caption",
        "description",
        "descriptions",
        "items",
        "rows",
        "list",
    }


def is_probably_metadata_key(parent_key: str | None) -> bool:
    if not parent_key:
        return False

    original = parent_key.strip()
    normalized = parent_key.strip().lower()
    if normalized in GENERIC_SKIP_KEYS:
        return True

    for suffix in METADATA_SUFFIXES:
        if normalized.endswith(f"_{suffix}") or normalized.endswith(f"-{suffix}"):
            return True
        if original.endswith(suffix.upper()) or original.endswith(suffix.capitalize()):
            return True

    return False


def contains_letter(text: str) -> bool:
    return any(char.isalpha() for char in text)


def looks_like_non_translatable_token(text: str) -> bool:
    if text.startswith(("http://", "https://", "www.")):
        return True

    if "@" in text and " " not in text:
        return True

    if len(text) == 1 and text.isalpha():
        return True

    if NUMERIC_PATTERN.fullmatch(text):
        return True

    if FORMULA_PATTERN.fullmatch(text):
        return True

    if UPPER_CODE_PATTERN.fullmatch(text):
        return True

    if CAMEL_CASE_PATTERN.fullmatch(text):
        return True

    if IDENTIFIER_WITH_SYMBOLS_PATTERN.fullmatch(text) and any(symbol in text for symbol in "_:/#"):
        return True

    return False


def should_translate_string(parent_key: str | None, value: str, *, mode: str) -> bool:
    text = value.strip()
    if not text:
        return False

    if mode == "legacy-keys":
        return legacy_should_translate_string(parent_key, value)

    if is_probably_metadata_key(parent_key):
        return False

    if not contains_letter(text):
        return False

    if looks_like_non_translatable_token(text):
        return False

    return True


def count_translatable_values(node: Any, *, parent_key: str | None, mode: str) -> int:
    if isinstance(node, dict):
        return sum(count_translatable_values(value, parent_key=key, mode=mode) for key, value in node.items())

    if isinstance(node, list):
        return sum(count_translatable_values(item, parent_key=parent_key, mode=mode) for item in node)

    if isinstance(node, str) and should_translate_string(parent_key, node, mode=mode):
        return 1

    return 0


def collect_translatable_strings(
    node: Any,
    *,
    parent_key: str | None,
    mode: str,
    unique_texts: dict[str, None],
) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            collect_translatable_strings(value, parent_key=key, mode=mode, unique_texts=unique_texts)
        return

    if isinstance(node, list):
        for item in node:
            collect_translatable_strings(item, parent_key=parent_key, mode=mode, unique_texts=unique_texts)
        return

    if isinstance(node, str) and should_translate_string(parent_key, node, mode=mode):
        unique_texts.setdefault(node, None)


def is_translategemma_model(model: str) -> bool:
    return model.strip().lower().startswith("translategemma")


def build_additional_translation_instructions(prefix: str, context: str) -> str:
    instructions: list[str] = []
    if prefix.strip():
        instructions.append(prefix.strip())
    if context.strip():
        instructions.append(context.strip())
    return "\n\n".join(instructions)


def build_batch_prompt(model: str, prefix: str, texts: list[str], *, context: str = "") -> str:
    if is_translategemma_model(model):
        additional_instructions = build_additional_translation_instructions(prefix, context)
        if len(texts) == 1:
            prompt = (
                "You are a professional English (en) to Spanish (es) translator. "
                "Your goal is to accurately convey the meaning and nuances of the original English text "
                "while adhering to Spanish grammar, vocabulary, and cultural sensitivities.\n"
                "Produce only the Spanish translation, without any additional explanations or commentary."
            )
            if additional_instructions:
                prompt += f"\n{additional_instructions}"
            prompt += (
                "\nPlease translate the following English text into Spanish:"
                f"\n\n\n{texts[0]}"
            )
            return prompt

        if len(texts) > 5:
            raise ValueError("TranslateGemma batch prompt supports at most 5 texts per request.")

        serialized_texts = json.dumps(texts, ensure_ascii=False)
        prompt = (
            "You are a professional English (en) to Spanish (es) translator. "
            "Your goal is to accurately convey the meaning and nuances of the original English text "
            "while adhering to Spanish grammar, vocabulary, and cultural sensitivities.\n"
            "Produce only a valid JSON array of Spanish translations, without any additional explanations or commentary. "
            "Return the same number of items, in the same order, and preserve placeholders, formatting, and proper names when appropriate."
        )
        if additional_instructions:
            prompt += f"\n{additional_instructions}"
        prompt += (
            "\nPlease translate the following English texts into Spanish:"
            f"\n\n\n{serialized_texts}"
        )
        return prompt

    serialized_texts = json.dumps(texts, ensure_ascii=False)
    context_instruction = ""
    if context.strip():
        context_instruction = f" Contexto adicional a tener en cuenta: {context.strip()}"
    return (
        "Traduci cada elemento del siguiente array al espanol rioplatense. "
        "Devolve solamente un JSON array valido de strings, en el mismo orden y con la misma cantidad de elementos. "
        "No agregues explicaciones, markdown ni texto extra. "
        "Respeta placeholders, formato y nombres propios cuando corresponda. "
        "Si un elemento no necesita traduccion, devolvelo exactamente igual. "
        f"Usa esta instruccion como criterio de traduccion para cada string: {prefix.strip()} "
        f"{context_instruction} "
        f"Array: {serialized_texts}"
    )


def normalize_translation(text: str) -> str:
    normalized = text.strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {'"', "'"}:
        normalized = normalized[1:-1].strip()
    return normalized


def strip_code_fences(text: str) -> str:
    normalized = text.strip()
    if normalized.startswith("```") and normalized.endswith("```"):
        lines = normalized.splitlines()
        if len(lines) >= 3:
            return "\n".join(lines[1:-1]).strip()
    return normalized


def parse_batch_response(raw_response: str, expected_size: int) -> list[str]:
    cleaned = strip_code_fences(raw_response)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise BatchResponseError(
            f"Ollama returned invalid batch JSON: {exc}\nResponse: {raw_response}"
        ) from exc

    if not isinstance(parsed, list):
        raise BatchResponseError("Ollama batch response was not a JSON array.")

    if len(parsed) != expected_size:
        raise BatchResponseError(
            "Ollama batch response size mismatch: "
            f"expected {expected_size}, got {len(parsed)}."
        )

    result: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            raise BatchResponseError("Ollama batch response must contain only strings.")
        result.append(normalize_translation(item))

    return result


def recover_single_translation(raw_response: str) -> str:
    cleaned = strip_code_fences(raw_response).strip()

    if cleaned.startswith("[") and cleaned.endswith("]"):
        cleaned = cleaned[1:-1].strip()

    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
        cleaned = cleaned[1:-1]

    cleaned = cleaned.replace(r'\n', '\n').replace(r'\t', '\t').strip()
    return normalize_translation(cleaned)


def print_progress(*, processed: int, total: int, cache_size: int) -> None:
    if total <= 0:
        return

    percent = (processed / total) * 100
    print(
        f"Progress: {processed}/{total} ({percent:.1f}%) | unique requests: {cache_size}",
        flush=True,
    )


def build_checkpoint_metadata(
    *,
    model: str,
    url: str,
    prompt_prefix: str,
    mode: str,
    context: str,
) -> dict[str, str]:
    return {
        "model": model,
        "url": url,
        "prompt_prefix": prompt_prefix,
        "mode": mode,
        "context": context,
    }


def load_translation_checkpoint(
    checkpoint_path: Path,
    *,
    metadata: dict[str, str],
    valid_texts: set[str],
) -> dict[str, str]:
    if not checkpoint_path.is_file():
        return {}

    try:
        checkpoint_data = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Warning: ignoring unreadable checkpoint {checkpoint_path}: {exc}", flush=True)
        return {}

    if not isinstance(checkpoint_data, dict):
        print(f"Warning: ignoring invalid checkpoint format in {checkpoint_path}", flush=True)
        return {}

    stored_metadata = checkpoint_data.get("metadata")
    stored_translations = checkpoint_data.get("translations")
    if stored_metadata != metadata:
        print(f"Warning: ignoring incompatible checkpoint {checkpoint_path}", flush=True)
        return {}
    if not isinstance(stored_translations, dict):
        print(f"Warning: ignoring invalid checkpoint translations in {checkpoint_path}", flush=True)
        return {}

    translations: dict[str, str] = {}
    for source, target in stored_translations.items():
        if (
            isinstance(source, str)
            and isinstance(target, str)
            and source in valid_texts
        ):
            translations[source] = target

    return translations


def save_translation_checkpoint(
    checkpoint_path: Path,
    *,
    metadata: dict[str, str],
    translations: dict[str, str],
) -> None:
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = checkpoint_path.with_suffix(checkpoint_path.suffix + ".tmp")
    payload = {
        "metadata": metadata,
        "translations": translations,
    }
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(checkpoint_path)


def post_to_ollama(*, url: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    http_request = request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=timeout) as response:
            raw_response = response.read().decode("utf-8")
    except (TimeoutError, socket.timeout) as exc:
        raise OllamaRequestError(
            f"Request to Ollama timed out after {timeout:g}s: {url}"
        ) from exc
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise OllamaRequestError(f"Ollama returned HTTP {exc.code}: {body}") from exc
    except error.URLError as exc:
        raise OllamaRequestError(f"Could not reach Ollama at {url}: {exc}") from exc

    try:
        response_data = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise OllamaRequestError(f"Ollama returned invalid JSON: {exc}") from exc

    if not isinstance(response_data, dict):
        raise OllamaRequestError("Ollama response was not a JSON object.")

    return response_data


def chunked(values: list[str], size: int) -> list[list[str]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def translate_batch(
    texts: list[str],
    *,
    model: str,
    url: str,
    prompt_prefix: str,
    context: str,
    timeout: float,
    retries: int,
    verbose: bool,
) -> list[str]:
    payload = {
        "model": model,
        "prompt": build_batch_prompt(model, prompt_prefix, texts, context=context),
        "stream": False,
    }
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        if attempt > 0:
            print(
                f"Retrying request ({attempt}/{retries}) for items batch size {len(texts)}...",
                flush=True,
            )

        try:
            response_data = post_to_ollama(url=url, payload=payload, timeout=timeout)
            translated_raw = response_data.get("response")
            if not isinstance(translated_raw, str):
                raise OllamaRequestError("Ollama response did not include a string 'response' field.")

            try:
                translated = parse_batch_response(translated_raw, len(texts))
            except BatchResponseError as exc:
                if len(texts) == 1:
                    translated = [recover_single_translation(translated_raw)]
                else:
                    last_error = exc
                    continue

            if verbose:
                for source, target in zip(texts, translated, strict=True):
                    print(f"Translated: {source} -> {target}")

            return translated
        except OllamaRequestError as exc:
            last_error = exc

    if last_error is None:
        raise SystemExit("Ollama request failed for an unknown reason.")
    raise last_error


def translate_unique_strings(
    texts: list[str],
    *,
    model: str,
    url: str,
    prompt_prefix: str,
    context: str,
    timeout: float,
    batch_size: int,
    retries: int,
    verbose: bool,
    checkpoint_path: Path | None = None,
    checkpoint_metadata: dict[str, str] | None = None,
) -> dict[str, str]:
    translations: dict[str, str] = {}
    if not texts:
        return translations

    total_texts = len(texts)
    pending_texts = texts
    if checkpoint_path is not None and checkpoint_metadata is not None:
        translations.update(
            load_translation_checkpoint(
                checkpoint_path,
                metadata=checkpoint_metadata,
                valid_texts=set(texts),
            )
        )
        if translations:
            print(
                f"Loaded {len(translations)} translations from checkpoint: {checkpoint_path}",
                flush=True,
            )
            print_progress(processed=len(translations), total=total_texts, cache_size=len(translations))
        pending_texts = [text for text in texts if text not in translations]

    def process_batch(batch: list[str], start_index: int) -> None:
        batch_start = start_index + 1
        batch_end = start_index + len(batch)
        print(
            f"Sending batch items {batch_start}-{batch_end}/{len(pending_texts)}",
            flush=True,
        )
        try:
            translated_batch = translate_batch(
                batch,
                model=model,
                url=url,
                prompt_prefix=prompt_prefix,
                context=context,
                timeout=timeout,
                retries=retries,
                verbose=verbose,
            )
        except BatchResponseError as exc:
            if len(batch) == 1:
                print(
                    f"Warning: using raw fallback for item {batch_start}/{len(pending_texts)} due to malformed response.",
                    flush=True,
                )
                translated_batch = [batch[0]]
            else:
                midpoint = len(batch) // 2
                print(
                    f"Warning: batch parse failed for items {batch_start}-{batch_end}. Retrying in smaller chunks.",
                    flush=True,
                )
                if verbose:
                    print(str(exc), flush=True)
                process_batch(batch[:midpoint], start_index)
                process_batch(batch[midpoint:], start_index + midpoint)
                return
        except OllamaRequestError as exc:
            if len(batch) == 1:
                print(
                    f"Warning: keeping source text for item {batch_start}/{len(pending_texts)} after request failure.",
                    flush=True,
                )
                if verbose:
                    print(str(exc), flush=True)
                translated_batch = [batch[0]]
            else:
                midpoint = len(batch) // 2
                print(
                    f"Warning: request failed for items {batch_start}-{batch_end}. Retrying in smaller chunks.",
                    flush=True,
                )
                if verbose:
                    print(str(exc), flush=True)
                process_batch(batch[:midpoint], start_index)
                process_batch(batch[midpoint:], start_index + midpoint)
                return

        for source, target in zip(batch, translated_batch, strict=True):
            translations[source] = target
        if checkpoint_path is not None and checkpoint_metadata is not None:
            save_translation_checkpoint(
                checkpoint_path,
                metadata=checkpoint_metadata,
                translations=translations,
            )
        print_progress(processed=len(translations), total=total_texts, cache_size=len(translations))

    for start_index in range(0, len(pending_texts), batch_size):
        process_batch(pending_texts[start_index:start_index + batch_size], start_index)

    return translations


def apply_translations(
    node: Any,
    *,
    parent_key: str | None,
    mode: str,
    translations: dict[str, str],
) -> Any:
    if isinstance(node, dict):
        return {
            key: apply_translations(value, parent_key=key, mode=mode, translations=translations)
            for key, value in node.items()
        }

    if isinstance(node, list):
        return [
            apply_translations(item, parent_key=parent_key, mode=mode, translations=translations)
            for item in node
        ]

    if isinstance(node, str) and should_translate_string(parent_key, node, mode=mode):
        return translations.get(node, node)

    return node


def default_output_path(input_path: Path) -> Path:
    return input_path.with_name(f"{input_path.stem}_es{input_path.suffix}")


def default_checkpoint_path(output_path: Path) -> Path:
    return output_path.with_suffix(output_path.suffix + ".checkpoint.json")


def main() -> int:
    args = parse_args()

    if args.show_keys:
        print_key_rules()
        return 0

    input_path = args.input_json
    if not input_path.is_file():
        raise SystemExit(f"Input file does not exist: {input_path}")

    if args.batch_size <= 0:
        raise SystemExit("--batch-size must be greater than 0")
    if args.retries < 0:
        raise SystemExit("--retries must be 0 or greater")

    output_path = input_path if args.overwrite else (args.output or default_output_path(input_path))
    checkpoint_path = args.checkpoint or default_checkpoint_path(output_path)
    resolved_context = args.context.strip()
    if args.dnd_context:
        resolved_context = f"{DND_CONTEXT} {resolved_context}".strip() if resolved_context else DND_CONTEXT
    effective_batch_size = min(args.batch_size, 5) if is_translategemma_model(args.model) else args.batch_size

    try:
        data = json.loads(input_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {input_path}: {exc}") from exc

    total_values = count_translatable_values(data, parent_key=None, mode=args.mode)
    unique_texts: dict[str, None] = {}
    collect_translatable_strings(data, parent_key=None, mode=args.mode, unique_texts=unique_texts)
    unique_values = list(unique_texts.keys())

    print(f"translatable values found: {total_values}")
    print(f"unique strings found: {len(unique_values)}")

    checkpoint_metadata = build_checkpoint_metadata(
        model=args.model,
        url=args.url,
        prompt_prefix=args.prompt_prefix,
        mode=args.mode,
        context=resolved_context,
    )

    translations = translate_unique_strings(
        unique_values,
        model=args.model,
        url=args.url,
        prompt_prefix=args.prompt_prefix,
        context=resolved_context,
        timeout=args.timeout,
        batch_size=effective_batch_size,
        retries=args.retries,
        verbose=args.verbose,
        checkpoint_path=checkpoint_path,
        checkpoint_metadata=checkpoint_metadata,
    )

    translated_data = apply_translations(data, parent_key=None, mode=args.mode, translations=translations)

    output_path.write_text(
        json.dumps(translated_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    checkpoint_removed = False
    if checkpoint_path.is_file():
        try:
            checkpoint_path.unlink()
            checkpoint_removed = True
        except OSError as exc:
            print(f"Warning: could not remove checkpoint {checkpoint_path}: {exc}", flush=True)

    print(f"input: {input_path}")
    print(f"output: {output_path}")
    print(f"checkpoint: {checkpoint_path}")
    if checkpoint_removed:
        print("checkpoint removed after successful run")
    print(f"model: {args.model}")
    print(f"mode: {args.mode}")
    print(f"context: {resolved_context or '<none>'}")
    print(f"batch size: {effective_batch_size}")
    print(f"retries: {args.retries}")
    print(f"unique strings sent to Ollama: {len(translations)}")
    print(f"total translated values: {total_values}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
