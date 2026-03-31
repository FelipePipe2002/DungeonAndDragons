CREATE TABLE IF NOT EXISTS building_map_refs (
    id BIGSERIAL PRIMARY KEY,
    building_id BIGINT NOT NULL UNIQUE,
    kind VARCHAR(20) NOT NULL,
    source VARCHAR(20),
    filename TEXT,
    url TEXT,
    storage_key TEXT,
    data_url TEXT,
    CONSTRAINT fk_building_map_refs_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    CONSTRAINT chk_building_map_kind CHECK (kind IN ('asset','embedded','external','stored','buildings')),
    CONSTRAINT chk_building_map_source CHECK (source IS NULL OR source IN ('asset','external')),
    CONSTRAINT chk_building_map_payload CHECK (
      (kind = 'asset' AND filename IS NOT NULL AND source IS NULL AND url IS NULL AND storage_key IS NULL AND data_url IS NULL)
      OR (kind = 'embedded' AND data_url IS NOT NULL AND source IS NULL AND filename IS NULL AND url IS NULL AND storage_key IS NULL)
      OR (kind = 'external' AND url IS NOT NULL AND source IS NULL AND filename IS NULL AND storage_key IS NULL AND data_url IS NULL)
      OR (kind = 'stored' AND storage_key IS NOT NULL AND source IS NULL AND filename IS NULL AND url IS NULL AND data_url IS NULL)
      OR (kind = 'buildings' AND FALSE)
    )
);

CREATE INDEX IF NOT EXISTS idx_building_map_refs_building ON building_map_refs (building_id);
