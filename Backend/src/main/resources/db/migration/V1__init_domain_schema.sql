CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    pwd TEXT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS landmarks (
    id BIGSERIAL PRIMARY KEY,
    icono TEXT NOT NULL DEFAULT '',
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    escala_icono DOUBLE PRECISION NOT NULL DEFAULT 1,
    escala_texto DOUBLE PRECISION NOT NULL DEFAULT 1,
    mostrar_leyenda BOOLEAN NOT NULL DEFAULT TRUE,
    posicion_x DOUBLE PRECISION NOT NULL,
    posicion_y DOUBLE PRECISION NOT NULL,
    poblacion INTEGER,
    descripcion_corta TEXT,
    historia TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_landmarks_tipo CHECK (tipo IN ('ciudad','pueblo','aldea','fuerte','puente','bandera','campamento','mazmorra')),
    CONSTRAINT chk_landmarks_escala_icono CHECK (escala_icono >= 0.6 AND escala_icono <= 2.4),
    CONSTRAINT chk_landmarks_escala_texto CHECK (escala_texto >= 0.6 AND escala_texto <= 2.4),
    CONSTRAINT chk_landmarks_posicion_x CHECK (posicion_x >= 0 AND posicion_x <= 1),
    CONSTRAINT chk_landmarks_posicion_y CHECK (posicion_y >= 0 AND posicion_y <= 1)
);

CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    imagen TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
    id BIGSERIAL PRIMARY KEY,
    landmark_id BIGINT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    clase VARCHAR(120) NOT NULL DEFAULT '',
    raza VARCHAR(120) NOT NULL DEFAULT '',
    descripcion TEXT NOT NULL DEFAULT '',
    imagen TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_characters_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buildings (
    id BIGSERIAL PRIMARY KEY,
    landmark_id BIGINT NOT NULL,
    organization_id BIGINT,
    nombre VARCHAR(200) NOT NULL,
    posicion_x DOUBLE PRECISION,
    posicion_y DOUBLE PRECISION,
    descripcion TEXT NOT NULL DEFAULT '',
    dueno_id BIGINT,
    dueno_nombre VARCHAR(200),
    map_building_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_buildings_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE,
    CONSTRAINT fk_buildings_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    CONSTRAINT fk_buildings_owner FOREIGN KEY (dueno_id) REFERENCES characters(id) ON DELETE SET NULL,
    CONSTRAINT uk_buildings_landmark_map_index UNIQUE (landmark_id, map_building_index),
    CONSTRAINT chk_buildings_posicion_pair CHECK (
      (posicion_x IS NULL AND posicion_y IS NULL) OR
      (posicion_x IS NOT NULL AND posicion_y IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS landmark_tags (
    id BIGSERIAL PRIMARY KEY,
    landmark_id BIGINT NOT NULL,
    tag VARCHAR(120) NOT NULL,
    CONSTRAINT fk_landmark_tags_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE,
    CONSTRAINT uk_landmark_tags UNIQUE (landmark_id, tag)
);

CREATE TABLE IF NOT EXISTS landmark_events (
    id BIGSERIAL PRIMARY KEY,
    landmark_id BIGINT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    fecha VARCHAR(120),
    posicion_x DOUBLE PRECISION,
    posicion_y DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_landmark_events_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE,
    CONSTRAINT chk_landmark_events_posicion_pair CHECK (
      (posicion_x IS NULL AND posicion_y IS NULL) OR
      (posicion_x IS NOT NULL AND posicion_y IS NOT NULL)
    ),
    CONSTRAINT chk_landmark_events_posicion_x CHECK (posicion_x IS NULL OR (posicion_x >= 0 AND posicion_x <= 1)),
    CONSTRAINT chk_landmark_events_posicion_y CHECK (posicion_y IS NULL OR (posicion_y >= 0 AND posicion_y <= 1))
);

CREATE TABLE IF NOT EXISTS landmark_map_refs (
    id BIGSERIAL PRIMARY KEY,
    landmark_id BIGINT NOT NULL UNIQUE,
    kind VARCHAR(20) NOT NULL,
    source VARCHAR(20),
    filename TEXT,
    url TEXT,
    storage_key TEXT,
    data_url TEXT,
    CONSTRAINT fk_landmark_map_refs_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE,
    CONSTRAINT chk_landmark_map_kind CHECK (kind IN ('asset','embedded','external','stored','buildings')),
    CONSTRAINT chk_landmark_map_source CHECK (source IS NULL OR source IN ('asset','external')),
    CONSTRAINT chk_landmark_map_payload CHECK (
      (kind = 'asset' AND filename IS NOT NULL AND source IS NULL AND url IS NULL AND storage_key IS NULL AND data_url IS NULL)
      OR (kind = 'embedded' AND data_url IS NOT NULL AND source IS NULL AND filename IS NULL AND url IS NULL AND storage_key IS NULL)
      OR (kind = 'external' AND url IS NOT NULL AND source IS NULL AND filename IS NULL AND storage_key IS NULL AND data_url IS NULL)
      OR (kind = 'stored' AND storage_key IS NOT NULL AND source IS NULL AND filename IS NULL AND url IS NULL AND data_url IS NULL)
      OR (kind = 'buildings' AND source = 'asset' AND filename IS NOT NULL AND url IS NULL AND storage_key IS NULL AND data_url IS NULL)
      OR (kind = 'buildings' AND source = 'external' AND url IS NOT NULL AND filename IS NULL AND storage_key IS NULL AND data_url IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS organization_tags (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    tag VARCHAR(120) NOT NULL,
    CONSTRAINT fk_organization_tags_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT uk_organization_tags UNIQUE (organization_id, tag)
);

CREATE TABLE IF NOT EXISTS organization_categories (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    categoria VARCHAR(120) NOT NULL,
    CONSTRAINT fk_organization_categories_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT uk_organization_categories UNIQUE (organization_id, categoria)
);

CREATE TABLE IF NOT EXISTS organization_landmarks (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    landmark_id BIGINT NOT NULL,
    CONSTRAINT fk_organization_landmarks_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_landmarks_landmark FOREIGN KEY (landmark_id) REFERENCES landmarks(id) ON DELETE CASCADE,
    CONSTRAINT uk_organization_landmarks UNIQUE (organization_id, landmark_id)
);

CREATE TABLE IF NOT EXISTS building_tags (
    id BIGSERIAL PRIMARY KEY,
    building_id BIGINT NOT NULL,
    tag VARCHAR(120) NOT NULL,
    CONSTRAINT fk_building_tags_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    CONSTRAINT uk_building_tags UNIQUE (building_id, tag)
);

CREATE TABLE IF NOT EXISTS character_tags (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL,
    tag VARCHAR(120) NOT NULL,
    CONSTRAINT fk_character_tags_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    CONSTRAINT uk_character_tags UNIQUE (character_id, tag)
);

CREATE TABLE IF NOT EXISTS character_events (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL,
    sesion VARCHAR(160) NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    fecha VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_character_events_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS character_buildings (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL,
    building_id BIGINT NOT NULL,
    CONSTRAINT fk_character_buildings_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    CONSTRAINT fk_character_buildings_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    CONSTRAINT uk_character_buildings UNIQUE (character_id, building_id)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    character_id BIGINT NOT NULL,
    categoria VARCHAR(120) NOT NULL DEFAULT '',
    CONSTRAINT fk_organization_memberships_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_memberships_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    CONSTRAINT uk_organization_memberships UNIQUE (organization_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_landmarks_nombre ON landmarks (nombre);
CREATE INDEX IF NOT EXISTS idx_buildings_nombre ON buildings (nombre);
CREATE INDEX IF NOT EXISTS idx_characters_nombre ON characters (nombre);
CREATE INDEX IF NOT EXISTS idx_organizations_nombre ON organizations (nombre);

CREATE INDEX IF NOT EXISTS idx_landmark_tags_landmark ON landmark_tags (landmark_id);
CREATE INDEX IF NOT EXISTS idx_landmark_events_landmark ON landmark_events (landmark_id);
CREATE INDEX IF NOT EXISTS idx_landmark_map_refs_landmark ON landmark_map_refs (landmark_id);
CREATE INDEX IF NOT EXISTS idx_buildings_landmark ON buildings (landmark_id);
CREATE INDEX IF NOT EXISTS idx_buildings_organization ON buildings (organization_id);
CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings (dueno_id);
CREATE INDEX IF NOT EXISTS idx_buildings_map_index ON buildings (map_building_index);
CREATE INDEX IF NOT EXISTS idx_building_tags_building ON building_tags (building_id);
CREATE INDEX IF NOT EXISTS idx_characters_landmark ON characters (landmark_id);
CREATE INDEX IF NOT EXISTS idx_character_tags_character ON character_tags (character_id);
CREATE INDEX IF NOT EXISTS idx_character_events_character ON character_events (character_id);
CREATE INDEX IF NOT EXISTS idx_character_buildings_character ON character_buildings (character_id);
CREATE INDEX IF NOT EXISTS idx_character_buildings_building ON character_buildings (building_id);
CREATE INDEX IF NOT EXISTS idx_organization_tags_org ON organization_tags (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_categories_org ON organization_categories (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_landmarks_org ON organization_landmarks (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_landmarks_landmark ON organization_landmarks (landmark_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org ON organization_memberships (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_character ON organization_memberships (character_id);
