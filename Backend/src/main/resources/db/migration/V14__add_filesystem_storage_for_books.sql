ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1024);

ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS chk_media_assets_storage_mode;

ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS chk_media_assets_payload;

ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS chk_media_assets_kind_payload;

ALTER TABLE media_assets
    ADD CONSTRAINT chk_media_assets_storage_mode
    CHECK (storage_mode IN ('db', 'file_system'));

ALTER TABLE media_assets
    ADD CONSTRAINT chk_media_assets_payload
    CHECK (
        (
            storage_mode = 'db'
            AND (
                (text_content IS NOT NULL AND binary_content IS NULL AND storage_path IS NULL)
                OR (text_content IS NULL AND binary_content IS NOT NULL AND storage_path IS NULL)
            )
        )
        OR (
            storage_mode = 'file_system'
            AND text_content IS NULL
            AND binary_content IS NULL
            AND storage_path IS NOT NULL
        )
    );

ALTER TABLE media_assets
    ADD CONSTRAINT chk_media_assets_kind_payload
    CHECK (
        (
            kind = 'json'
            AND storage_mode = 'db'
            AND text_content IS NOT NULL
            AND binary_content IS NULL
            AND storage_path IS NULL
        )
        OR (
            kind IN ('image', 'binary', 'book')
            AND storage_mode = 'db'
            AND text_content IS NULL
            AND binary_content IS NOT NULL
            AND storage_path IS NULL
        )
        OR (
            kind = 'book'
            AND storage_mode = 'file_system'
            AND text_content IS NULL
            AND binary_content IS NULL
            AND storage_path IS NOT NULL
        )
    );
