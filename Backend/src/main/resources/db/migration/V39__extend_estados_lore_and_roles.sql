ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '';

ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS historia TEXT NOT NULL DEFAULT '';

ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS gobierno_tipo VARCHAR(120) NOT NULL DEFAULT '';

ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS imagen TEXT;

ALTER TABLE estados
    ADD COLUMN IF NOT EXISTS imagen_asset_id BIGINT;

ALTER TABLE estados
    ADD CONSTRAINT fk_estados_image_asset
    FOREIGN KEY (imagen_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estados_image_asset ON estados (imagen_asset_id);

CREATE TABLE IF NOT EXISTS estado_miembros (
    id BIGSERIAL PRIMARY KEY,
    estado_id BIGINT NOT NULL,
    character_id BIGINT NOT NULL,
    rol VARCHAR(120) NOT NULL DEFAULT '',
    CONSTRAINT fk_estado_miembros_estado FOREIGN KEY (estado_id) REFERENCES estados(id) ON DELETE CASCADE,
    CONSTRAINT fk_estado_miembros_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_estado_miembros_estado ON estado_miembros (estado_id);
CREATE INDEX IF NOT EXISTS idx_estado_miembros_character ON estado_miembros (character_id);

CREATE TABLE IF NOT EXISTS estado_landmark_roles (
    id BIGSERIAL PRIMARY KEY,
    estado_id BIGINT NOT NULL,
    landmark_id BIGINT NOT NULL,
    rol VARCHAR(120) NOT NULL DEFAULT '',
    CONSTRAINT fk_estado_landmark_roles_estado FOREIGN KEY (estado_id) REFERENCES estados(id) ON DELETE CASCADE,
    CONSTRAINT fk_estado_landmark_roles_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_estado_landmark_roles_estado ON estado_landmark_roles (estado_id);
CREATE INDEX IF NOT EXISTS idx_estado_landmark_roles_landmark ON estado_landmark_roles (landmark_id);

CREATE TABLE IF NOT EXISTS estado_subdivision_names (
    id BIGSERIAL PRIMARY KEY,
    estado_id BIGINT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    CONSTRAINT fk_estado_subdivision_names_estado FOREIGN KEY (estado_id) REFERENCES estados(id) ON DELETE CASCADE,
    CONSTRAINT uk_estado_subdivision_names UNIQUE (estado_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_estado_subdivision_names_estado ON estado_subdivision_names (estado_id);
