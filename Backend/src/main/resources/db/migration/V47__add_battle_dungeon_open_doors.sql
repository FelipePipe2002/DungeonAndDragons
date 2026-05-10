ALTER TABLE battle_states
    ALTER COLUMN dungeon_fog_json SET DEFAULT '{"enabled":false,"exploredCellKeys":[],"openDoorIds":[],"playerVisionBrightRadiusCells":4,"playerVisionDimRadiusCells":8}';

UPDATE battle_states
SET dungeon_fog_json = '{"enabled":false,"exploredCellKeys":[],"openDoorIds":[],"playerVisionBrightRadiusCells":4,"playerVisionDimRadiusCells":8}'
WHERE dungeon_fog_json IS NULL OR dungeon_fog_json = '';
