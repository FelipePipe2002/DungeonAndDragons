ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS next_obstacle_id INTEGER NOT NULL DEFAULT 1;

ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS obstacles_json TEXT NOT NULL DEFAULT '[]';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_battle_states_next_obstacle_id'
    ) THEN
        ALTER TABLE battle_states
            ADD CONSTRAINT chk_battle_states_next_obstacle_id CHECK (next_obstacle_id >= 1);
    END IF;
END $$;
