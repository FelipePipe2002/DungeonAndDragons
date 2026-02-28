UPDATE tags
SET nombre = LOWER(TRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE taggings tg
SET tag_id = canonical.canonical_id
FROM (
    SELECT t.id AS old_id, MIN(t2.id) AS canonical_id
    FROM tags t
    JOIN tags t2 ON t2.nombre = t.nombre
    GROUP BY t.id
) canonical
WHERE tg.tag_id = canonical.old_id
  AND tg.tag_id <> canonical.canonical_id;

DELETE FROM taggings
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY tag_id, entity_type, entity_id
                   ORDER BY id
               ) AS row_num
        FROM taggings
    ) duplicates
    WHERE duplicates.row_num > 1
);

DELETE FROM tags
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY nombre
                   ORDER BY id
               ) AS row_num
        FROM tags
    ) duplicates
    WHERE duplicates.row_num > 1
);

ALTER TABLE tags
ADD CONSTRAINT chk_tags_nombre_normalized
CHECK (nombre = LOWER(TRIM(nombre)));

CREATE INDEX IF NOT EXISTS idx_taggings_tag_entity_type
ON taggings (tag_id, entity_type);
