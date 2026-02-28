ALTER TABLE characters
ALTER COLUMN landmark_id DROP NOT NULL;

ALTER TABLE characters
DROP CONSTRAINT IF EXISTS fk_characters_landmark;

ALTER TABLE characters
ADD CONSTRAINT fk_characters_landmark
FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE SET NULL;
