CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_monster_token_filename
    ON media_assets (filename)
    WHERE kind = 'image' AND filename LIKE 'monster-token/%';
