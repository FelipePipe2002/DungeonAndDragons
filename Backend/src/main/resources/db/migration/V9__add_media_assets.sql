CREATE TABLE media_assets (
    id BIGSERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    byte_size BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64),
    storage_mode VARCHAR(20) NOT NULL,
    text_content TEXT,
    binary_content BYTEA,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_media_assets_kind CHECK (kind IN ('image', 'json', 'binary')),
    CONSTRAINT chk_media_assets_storage_mode CHECK (storage_mode IN ('db')),
    CONSTRAINT chk_media_assets_byte_size CHECK (byte_size >= 0),
    CONSTRAINT chk_media_assets_payload CHECK (
        (text_content IS NOT NULL AND binary_content IS NULL)
        OR (text_content IS NULL AND binary_content IS NOT NULL)
    ),
    CONSTRAINT chk_media_assets_kind_payload CHECK (
        (kind = 'json' AND text_content IS NOT NULL AND binary_content IS NULL)
        OR (kind IN ('image', 'binary') AND text_content IS NULL AND binary_content IS NOT NULL)
    )
);

ALTER TABLE characters
    ADD COLUMN IF NOT EXISTS imagen_asset_id BIGINT;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS imagen_asset_id BIGINT;

ALTER TABLE landmarks
    ADD COLUMN IF NOT EXISTS map_asset_id BIGINT;

ALTER TABLE characters
    ADD CONSTRAINT fk_characters_image_asset
    FOREIGN KEY (imagen_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_image_asset
    FOREIGN KEY (imagen_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE landmarks
    ADD CONSTRAINT fk_landmarks_map_asset
    FOREIGN KEY (map_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX idx_characters_image_asset ON characters (imagen_asset_id);
CREATE INDEX idx_organizations_image_asset ON organizations (imagen_asset_id);
CREATE INDEX idx_landmarks_map_asset ON landmarks (map_asset_id);
