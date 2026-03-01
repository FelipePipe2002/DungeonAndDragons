ALTER TABLE landmarks
    ADD COLUMN map_grid_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN map_grid_cell_size INTEGER NOT NULL DEFAULT 48,
    ADD COLUMN map_grid_offset_x INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN map_grid_offset_y INTEGER NOT NULL DEFAULT 0;

ALTER TABLE landmarks
    ADD CONSTRAINT chk_landmarks_map_grid_cell_size
    CHECK (map_grid_cell_size >= 8 AND map_grid_cell_size <= 512);
