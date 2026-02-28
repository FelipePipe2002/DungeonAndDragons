ALTER TABLE buildings
ALTER COLUMN landmark_id DROP NOT NULL;

ALTER TABLE buildings
DROP CONSTRAINT IF EXISTS fk_buildings_landmark;

ALTER TABLE buildings
ADD CONSTRAINT fk_buildings_landmark
FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE SET NULL;
