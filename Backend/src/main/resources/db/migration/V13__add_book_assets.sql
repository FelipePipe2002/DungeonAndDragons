ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS chk_media_assets_kind;

ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS chk_media_assets_kind_payload;

ALTER TABLE media_assets
    ADD CONSTRAINT chk_media_assets_kind
    CHECK (kind IN ('image', 'json', 'book', 'binary'));

ALTER TABLE media_assets
    ADD CONSTRAINT chk_media_assets_kind_payload
    CHECK (
        (kind = 'json' AND text_content IS NOT NULL AND binary_content IS NULL)
        OR (kind IN ('image', 'book', 'binary') AND text_content IS NULL AND binary_content IS NOT NULL)
    );
