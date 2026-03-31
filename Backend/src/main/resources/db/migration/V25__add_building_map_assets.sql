ALTER TABLE buildings
    ADD COLUMN IF NOT EXISTS map_asset_id BIGINT;

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
