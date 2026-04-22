CREATE TABLE IF NOT EXISTS estados (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(120) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estados_nombre ON estados (nombre);

CREATE TABLE IF NOT EXISTS subdivisiones (
    id BIGSERIAL PRIMARY KEY,
    estado_id BIGINT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(120) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_subdivisiones_estado FOREIGN KEY (estado_id) REFERENCES estados(id) ON DELETE CASCADE,
    CONSTRAINT uk_subdivisiones_estado_nombre UNIQUE (estado_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_subdivisiones_estado ON subdivisiones (estado_id);
CREATE INDEX IF NOT EXISTS idx_subdivisiones_nombre ON subdivisiones (nombre);

ALTER TABLE landmarks
    ADD COLUMN estado_id BIGINT;

ALTER TABLE landmarks
    ADD COLUMN subdivision_id BIGINT;

ALTER TABLE landmarks
    ADD CONSTRAINT fk_landmarks_estado FOREIGN KEY (estado_id) REFERENCES estados(id) ON DELETE SET NULL;

ALTER TABLE landmarks
    ADD CONSTRAINT fk_landmarks_subdivision FOREIGN KEY (subdivision_id) REFERENCES subdivisiones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_landmarks_estado ON landmarks (estado_id);
CREATE INDEX IF NOT EXISTS idx_landmarks_subdivision ON landmarks (subdivision_id);
