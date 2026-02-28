CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    CONSTRAINT uk_tags_nombre UNIQUE (nombre)
);

CREATE TABLE IF NOT EXISTS taggings (
    id BIGSERIAL PRIMARY KEY,
    tag_id BIGINT NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    CONSTRAINT fk_taggings_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    CONSTRAINT chk_taggings_entity_type CHECK (entity_type IN ('landmark','building','character','organization')),
    CONSTRAINT uk_taggings_unique UNIQUE (tag_id, entity_type, entity_id)
);

INSERT INTO tags (nombre)
SELECT DISTINCT source.tag
FROM (
    SELECT tag FROM landmark_tags
    UNION ALL
    SELECT tag FROM building_tags
    UNION ALL
    SELECT tag FROM character_tags
    UNION ALL
    SELECT tag FROM organization_tags
) AS source
WHERE source.tag IS NOT NULL
  AND TRIM(source.tag) <> '';

INSERT INTO taggings (tag_id, entity_type, entity_id)
SELECT t.id, 'landmark', lt.landmark_id
FROM landmark_tags lt
JOIN tags t ON t.nombre = lt.tag;

INSERT INTO taggings (tag_id, entity_type, entity_id)
SELECT t.id, 'building', bt.building_id
FROM building_tags bt
JOIN tags t ON t.nombre = bt.tag;

INSERT INTO taggings (tag_id, entity_type, entity_id)
SELECT t.id, 'character', ct.character_id
FROM character_tags ct
JOIN tags t ON t.nombre = ct.tag;

INSERT INTO taggings (tag_id, entity_type, entity_id)
SELECT t.id, 'organization', ot.organization_id
FROM organization_tags ot
JOIN tags t ON t.nombre = ot.tag;

CREATE INDEX IF NOT EXISTS idx_taggings_entity ON taggings (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_taggings_tag ON taggings (tag_id);
