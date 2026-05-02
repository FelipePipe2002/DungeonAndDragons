ALTER TABLE battle_states
    ADD COLUMN IF NOT EXISTS dungeon_fog_json TEXT;

UPDATE battle_states
SET dungeon_fog_json = COALESCE(NULLIF(dungeon_fog_json, ''), '{"enabled":false,"exploredCellKeys":[],"playerVisionBrightRadiusCells":4,"playerVisionDimRadiusCells":8}');

ALTER TABLE battle_states
    ALTER COLUMN dungeon_fog_json SET DEFAULT '{"enabled":false,"exploredCellKeys":[],"playerVisionBrightRadiusCells":4,"playerVisionDimRadiusCells":8}';

ALTER TABLE battle_states
    ALTER COLUMN dungeon_fog_json SET NOT NULL;
