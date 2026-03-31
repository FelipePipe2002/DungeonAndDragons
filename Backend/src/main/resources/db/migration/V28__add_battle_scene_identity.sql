ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS scene_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS scene_slug VARCHAR(255),
    ADD COLUMN IF NOT EXISTS parent_landmark_slug VARCHAR(255);

UPDATE battle_states
SET
    scene_type = COALESCE(scene_type, 'LANDMARK'),
    scene_slug = COALESCE(scene_slug, landmark_slug),
    parent_landmark_slug = COALESCE(parent_landmark_slug, landmark_slug)
WHERE scene_type IS NULL OR scene_slug IS NULL OR parent_landmark_slug IS NULL;

ALTER TABLE battle_states
    ALTER COLUMN scene_type SET DEFAULT 'LANDMARK';

ALTER TABLE battle_states
    ALTER COLUMN scene_type SET NOT NULL;

ALTER TABLE battle_states
    ALTER COLUMN scene_slug SET NOT NULL;

ALTER TABLE battle_states
    ALTER COLUMN parent_landmark_slug SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_battle_states_scene_type'
    ) THEN
        ALTER TABLE battle_states
            ADD CONSTRAINT chk_battle_states_scene_type CHECK (scene_type IN ('LANDMARK', 'BUILDING'));
    END IF;
END $$;

DROP INDEX IF EXISTS uq_battle_states_active_landmark;

CREATE INDEX IF NOT EXISTS idx_battle_states_parent_landmark_slug
    ON battle_states (parent_landmark_slug);

CREATE INDEX IF NOT EXISTS idx_battle_states_scene_identity
    ON battle_states (scene_type, scene_slug);

CREATE UNIQUE INDEX IF NOT EXISTS uq_battle_states_active_scene
    ON battle_states (scene_type, scene_slug)
    WHERE status = 'ACTIVE';

ALTER TABLE battle_states
    DROP COLUMN IF EXISTS landmark_slug;
