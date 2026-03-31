ALTER TABLE buildings
    ADD COLUMN IF NOT EXISTS map_asset_id BIGINT,
    ADD COLUMN IF NOT EXISTS map_rotation_degrees INTEGER,
    ADD COLUMN IF NOT EXISTS map_grid_enabled BOOLEAN,
    ADD COLUMN IF NOT EXISTS map_grid_cell_size DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS map_grid_offset_x DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS map_grid_offset_y DOUBLE PRECISION;

UPDATE buildings
SET
    map_rotation_degrees = COALESCE(map_rotation_degrees, 0),
    map_grid_enabled = COALESCE(map_grid_enabled, FALSE),
    map_grid_cell_size = COALESCE(map_grid_cell_size, 48),
    map_grid_offset_x = COALESCE(map_grid_offset_x, 0),
    map_grid_offset_y = COALESCE(map_grid_offset_y, 0)
WHERE
    map_rotation_degrees IS NULL
    OR map_grid_enabled IS NULL
    OR map_grid_cell_size IS NULL
    OR map_grid_offset_x IS NULL
    OR map_grid_offset_y IS NULL;

ALTER TABLE buildings
    ALTER COLUMN map_rotation_degrees SET DEFAULT 0,
    ALTER COLUMN map_rotation_degrees SET NOT NULL,
    ALTER COLUMN map_grid_enabled SET DEFAULT FALSE,
    ALTER COLUMN map_grid_enabled SET NOT NULL,
    ALTER COLUMN map_grid_cell_size SET DEFAULT 48,
    ALTER COLUMN map_grid_cell_size SET NOT NULL,
    ALTER COLUMN map_grid_offset_x SET DEFAULT 0,
    ALTER COLUMN map_grid_offset_x SET NOT NULL,
    ALTER COLUMN map_grid_offset_y SET DEFAULT 0,
    ALTER COLUMN map_grid_offset_y SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_buildings_map_asset'
    ) THEN
        ALTER TABLE buildings
            ADD CONSTRAINT fk_buildings_map_asset
            FOREIGN KEY (map_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buildings_map_asset ON buildings (map_asset_id);

CREATE TABLE IF NOT EXISTS building_map_refs (
    id BIGSERIAL PRIMARY KEY,
    building_id BIGINT NOT NULL UNIQUE,
    kind VARCHAR(20) NOT NULL,
    source VARCHAR(20),
    filename TEXT,
    url TEXT,
    storage_key TEXT,
    data_url TEXT,
    CONSTRAINT fk_building_map_refs_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

ALTER TABLE building_map_refs
    ADD COLUMN IF NOT EXISTS building_id BIGINT,
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20),
    ADD COLUMN IF NOT EXISTS source VARCHAR(20),
    ADD COLUMN IF NOT EXISTS filename TEXT,
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS storage_key TEXT,
    ADD COLUMN IF NOT EXISTS data_url TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_building_map_refs_building'
    ) THEN
        ALTER TABLE building_map_refs
            ADD CONSTRAINT fk_building_map_refs_building
            FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_building_map_refs_building ON building_map_refs (building_id);

ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS scene_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS scene_slug VARCHAR(255),
    ADD COLUMN IF NOT EXISTS parent_landmark_slug VARCHAR(255);

UPDATE battle_states
SET scene_type = 'LANDMARK'
WHERE scene_type IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'battle_states'
          AND column_name = 'landmark_slug'
    ) THEN
        EXECUTE '
            UPDATE battle_states
            SET scene_slug = landmark_slug
            WHERE scene_slug IS NULL
        ';

        EXECUTE '
            UPDATE battle_states
            SET parent_landmark_slug = landmark_slug
            WHERE parent_landmark_slug IS NULL
        ';
    END IF;
END $$;

UPDATE battle_states
SET scene_slug = slug
WHERE scene_slug IS NULL;

UPDATE battle_states
SET parent_landmark_slug = COALESCE(scene_slug, slug)
WHERE parent_landmark_slug IS NULL;

ALTER TABLE battle_states
    ALTER COLUMN scene_type SET DEFAULT 'LANDMARK',
    ALTER COLUMN scene_type SET NOT NULL,
    ALTER COLUMN scene_slug SET NOT NULL,
    ALTER COLUMN parent_landmark_slug SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_battle_states_parent_landmark_slug
    ON battle_states (parent_landmark_slug);

CREATE INDEX IF NOT EXISTS idx_battle_states_scene_identity
    ON battle_states (scene_type, scene_slug);
