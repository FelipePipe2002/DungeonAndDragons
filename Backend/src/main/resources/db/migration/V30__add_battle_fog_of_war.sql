ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS fog_enabled BOOLEAN,
    ADD COLUMN IF NOT EXISTS next_fog_reveal_id INTEGER,
    ADD COLUMN IF NOT EXISTS fog_reveals_json TEXT;

UPDATE battle_states
SET
    fog_enabled = COALESCE(fog_enabled, FALSE),
    next_fog_reveal_id = COALESCE(next_fog_reveal_id, 1),
    fog_reveals_json = COALESCE(NULLIF(fog_reveals_json, ''), '[]');

ALTER TABLE battle_states
    ALTER COLUMN fog_enabled SET DEFAULT FALSE;

ALTER TABLE battle_states
    ALTER COLUMN fog_enabled SET NOT NULL;

ALTER TABLE battle_states
    ALTER COLUMN next_fog_reveal_id SET DEFAULT 1;

ALTER TABLE battle_states
    ALTER COLUMN next_fog_reveal_id SET NOT NULL;

ALTER TABLE battle_states
    ALTER COLUMN fog_reveals_json SET DEFAULT '[]';

ALTER TABLE battle_states
    ALTER COLUMN fog_reveals_json SET NOT NULL;
