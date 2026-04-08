CREATE TABLE IF NOT EXISTS dm_relationships (
    id BIGSERIAL PRIMARY KEY,
    left_entity_type VARCHAR(30) NOT NULL,
    left_entity_id BIGINT NOT NULL,
    right_entity_type VARCHAR(30) NOT NULL,
    right_entity_id BIGINT NOT NULL,
    direction VARCHAR(20) NOT NULL,
    label VARCHAR(120) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_relationships_updated_at ON dm_relationships (updated_at DESC, id DESC);
