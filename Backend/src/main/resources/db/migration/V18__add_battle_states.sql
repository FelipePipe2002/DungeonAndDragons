CREATE TABLE IF NOT EXISTS battle_states (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    landmark_slug VARCHAR(255),
    next_token_number INTEGER NOT NULL DEFAULT 1,
    tokens_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_battle_states_next_token_number CHECK (next_token_number >= 1)
);
