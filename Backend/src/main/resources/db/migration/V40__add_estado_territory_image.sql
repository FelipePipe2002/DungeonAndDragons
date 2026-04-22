ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS territorio_imagen TEXT;

ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS territorio_imagen_asset_id BIGINT;

ALTER TABLE estados
    ADD CONSTRAINT fk_estados_territorio_image_asset
    FOREIGN KEY (territorio_imagen_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estados_territorio_image_asset ON estados (territorio_imagen_asset_id);
