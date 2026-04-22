ALTER TABLE landmarks
    DROP CONSTRAINT IF EXISTS fk_landmarks_subdivision;

UPDATE landmarks
SET subdivision_id = NULL
WHERE subdivision_id IS NOT NULL
  AND subdivision_id NOT IN (SELECT id FROM estados);

ALTER TABLE landmarks
    ADD CONSTRAINT fk_landmarks_subdivision FOREIGN KEY (subdivision_id) REFERENCES estados(id) ON DELETE SET NULL;
