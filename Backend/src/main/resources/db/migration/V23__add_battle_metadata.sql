ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS round_number INTEGER,
    ADD COLUMN IF NOT EXISTS dm_notes TEXT;

UPDATE battle_states
SET
    title = COALESCE(NULLIF(TRIM(title), ''), 'Batalla'),
    round_number = COALESCE(round_number, 1);

ALTER TABLE battle_states
    ALTER COLUMN title SET NOT NULL;

ALTER TABLE battle_states
    ALTER COLUMN round_number SET DEFAULT 1;

ALTER TABLE battle_states
    ALTER COLUMN round_number SET NOT NULL;
