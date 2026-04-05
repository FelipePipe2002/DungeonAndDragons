// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"

import { MONSTER_UI_CSS } from "@/lib/monster/monster-ui-css"
import MonsterCard from "@/components/monster/monster-card"

const OPERATOR_OPTIONS = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" }
];

const NUMERIC_TARGET_OPTIONS = [
  { value: "cr", label: "CR" },
  { value: "ac", label: "AR" },
  { value: "hp", label: "HP" }
];

const DEFAULT_FILTERS = Object.freeze({
  q: "",
  numericField: "ac",
  numericOp: "gte",
  numericValue: ""
});
const FILTER_DEBOUNCE_MS = 450;

function createDefaultFilters() {
  return { ...DEFAULT_FILTERS };
}

function hasActiveFilters(filters) {
  return String(filters?.q ?? "").trim() !== "" || String(filters?.numericValue ?? "").trim() !== "";
}

async function requestBatch(offset, limit, filters, signal) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit)
  });

  const queryText = String(filters?.q ?? "").trim();
  if (queryText) {
    params.set("q", queryText);
  }

  const numericField = String(filters?.numericField ?? "").trim();
  const numericOp = String(filters?.numericOp ?? "").trim();
  const numericValue = String(filters?.numericValue ?? "").trim();

  if (numericField && numericValue) {
    params.set(numericField, numericValue);
    if (numericOp) {
      params.set(`${numericField}Op`, numericOp);
    }
  }

  const response = await fetch(`/monster-api/monsters?${params.toString()}`, {
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el lote de monstruos.");
  }

  return response.json();
}

export default function MonstersSearch({
  batchSize,
  initialHasMore,
  initialItems,
  initialNextOffset,
  total
}) {
  const [monsters, setMonsters] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [currentTotal, setCurrentTotal] = useState(total);
  const [filters, setFilters] = useState(createDefaultFilters);
  const [draftFilters, setDraftFilters] = useState(createDefaultFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);
  const sentinelRef = useRef(null);
  const filtersRef = useRef(createDefaultFilters());
  const debounceTimerRef = useRef(null);
  const autoApplyReadyRef = useRef(false);
  const skipNextAutoApplyRef = useRef(false);
  const filtersAbortRef = useRef(null);
  const filtersRequestIdRef = useRef(0);

  function updateDraftFilter(key, value) {
    setDraftFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function reloadWithFilters(nextFilters) {
    const requestId = filtersRequestIdRef.current + 1;
    filtersRequestIdRef.current = requestId;
    filtersAbortRef.current?.abort();
    const controller = new AbortController();
    filtersAbortRef.current = controller;
    inFlightRef.current = true;
    setLoading(true);
    setError("");

    try {
      const batch = await requestBatch(0, batchSize, nextFilters, controller.signal);
      if (requestId !== filtersRequestIdRef.current) {
        return;
      }

      setMonsters(batch.items);
      setHasMore(batch.hasMore);
      setNextOffset(batch.nextOffset);
      setCurrentTotal(batch.total);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Error inesperado al filtrar monstruos.");
    } finally {
      if (requestId === filtersRequestIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }

  async function applyFilters(event) {
    event.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const nextFilters = { ...draftFilters };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    await reloadWithFilters(nextFilters);
  }

  async function clearFilters() {
    const nextFilters = createDefaultFilters();
    skipNextAutoApplyRef.current = true;
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    await reloadWithFilters(nextFilters);
  }

  async function loadMore() {
    if (inFlightRef.current || loading || !hasMore) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError("");

    try {
      const batch = await requestBatch(nextOffset, batchSize, filtersRef.current);

      setMonsters((current) => [...current, ...batch.items]);
      setHasMore(batch.hasMore);
      setNextOffset(batch.nextOffset);
      setCurrentTotal(batch.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado al cargar monstruos.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoApplyReadyRef.current) {
      autoApplyReadyRef.current = true;
      return undefined;
    }

    if (skipNextAutoApplyRef.current) {
      skipNextAutoApplyRef.current = false;
      return undefined;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const nextFilters = { ...draftFilters };
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      void reloadWithFilters(nextFilters);
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [draftFilters, batchSize]);

  useEffect(() => {
    if (!hasMore || loading || !sentinelRef.current) {
      return undefined;
    }

    const currentTarget = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(currentTarget);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, nextOffset]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      filtersAbortRef.current?.abort();
    };
  }, []);

  return (
    <section className="monster-ui-theme">
      <style data-monster-ui="true">{MONSTER_UI_CSS}</style>
      <section className="filters-panel">
        <form className="filters-form" onSubmit={(event) => void applyFilters(event)}>
          <div className="filters-grid-text">
            <label className="filter-field">
              <span>Busqueda General</span>
              <input
                onChange={(event) => updateDraftFilter("q", event.target.value)}
                placeholder="Nombre, alias, type, tags..."
                type="text"
                value={draftFilters.q}
              />
            </label>
          </div>

          <div className="filters-grid-numeric">
            <label className="filter-field">
              <span>Filtro Numerico</span>
              <div className="filter-numeric filter-numeric-wide">
                <select
                  onChange={(event) => updateDraftFilter("numericField", event.target.value)}
                  value={draftFilters.numericField}
                >
                  {NUMERIC_TARGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  onChange={(event) => updateDraftFilter("numericOp", event.target.value)}
                  value={draftFilters.numericOp}
                >
                  {OPERATOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  onChange={(event) => updateDraftFilter("numericValue", event.target.value)}
                  placeholder="Valor"
                  type="text"
                  value={draftFilters.numericValue}
                />
              </div>
            </label>
          </div>

          <div className="filters-actions">
            <button className="filter-button" disabled={loading} type="submit">
              {loading ? "Aplicando..." : "Aplicar Ahora"}
            </button>
            <button
              className="filter-button filter-button-secondary"
              disabled={loading}
              onClick={() => void clearFilters()}
              type="button"
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="cards-stack">
        {monsters.map((monster, index) => (
          <MonsterCard key={`${monster?.name || "monster"}-${index}`} monster={monster} index={index} />
        ))}
      </section>

      <section className="feed-status">
        <p>
          Mostrando {monsters.length} de {currentTotal}
          {hasActiveFilters(filters) ? " (filtrados)" : ""}
        </p>

        {error && <p className="status-error">{error}</p>}

        {hasMore ? (
          <div className="sentinel-wrap">
            <button className="load-more-button" disabled={loading} onClick={() => void loadMore()} type="button">
              {loading ? "Cargando..." : `Cargar ${batchSize} mas`}
            </button>
            <div aria-hidden="true" className="scroll-sentinel" ref={sentinelRef} />
          </div>
        ) : (
          <p className="status-done">Se cargaron todos los monstruos.</p>
        )}
      </section>
    </section>
  );
}
