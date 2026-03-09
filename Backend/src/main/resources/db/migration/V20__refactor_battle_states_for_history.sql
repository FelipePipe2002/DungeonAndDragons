ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;

UPDATE battle_states
SET
    status = CASE
        WHEN landmark_slug IS NULL THEN 'FINISHED'
        ELSE 'ACTIVE'
    END,
    ended_at = CASE
        WHEN landmark_slug IS NULL THEN COALESCE(ended_at, NOW())
        ELSE NULL
    END;

ALTER TABLE battle_states
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE battle_states
    ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_battle_states_status'
    ) THEN
        ALTER TABLE battle_states
            ADD CONSTRAINT chk_battle_states_status CHECK (status IN ('ACTIVE', 'FINISHED'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_battle_states_active_landmark
    ON battle_states (landmark_slug)
    WHERE status = 'ACTIVE' AND landmark_slug IS NOT NULL;
