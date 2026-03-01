CREATE TABLE IF NOT EXISTS saved_pages (
    id BIGSERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_saved_pages_url CHECK (url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_saved_pages_titulo ON saved_pages (titulo);
