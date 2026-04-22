ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS estado_padre_id BIGINT;

ALTER TABLE estados
    ADD CONSTRAINT fk_estados_padre
    FOREIGN KEY (estado_padre_id) REFERENCES estados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estados_padre ON estados (estado_padre_id);
