CREATE TABLE IF NOT EXISTS dm_open_loops (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    loop_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    summary TEXT NOT NULL,
    next_step TEXT,
    consequence TEXT,
    reward TEXT,
    location VARCHAR(120),
    due_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_open_loops_updated_at ON dm_open_loops (updated_at DESC, id DESC);
