CREATE TABLE IF NOT EXISTS dm_events (
    id BIGSERIAL PRIMARY KEY,
    titulo VARCHAR(200),
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_events_created_at ON dm_events (created_at DESC, id DESC);
