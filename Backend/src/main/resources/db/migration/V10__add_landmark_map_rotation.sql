ALTER TABLE landmarks
    ADD COLUMN map_rotation_degrees INTEGER NOT NULL DEFAULT 0;

ALTER TABLE landmarks
    ADD CONSTRAINT chk_landmarks_map_rotation_degrees
    CHECK (map_rotation_degrees IN (0, 90, 180, 270));
