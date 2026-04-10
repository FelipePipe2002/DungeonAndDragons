CREATE TABLE IF NOT EXISTS party_inventory_balance (
    id BIGINT PRIMARY KEY,
    copper BIGINT NOT NULL DEFAULT 0,
    silver BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    platinum BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_inventory_items (
    id BIGSERIAL PRIMARY KEY,
    kind VARCHAR(30) NOT NULL,
    name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    carried_by VARCHAR(120),
    notes TEXT,
    source_item_name VARCHAR(200),
    source_item_type_code VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_inventory_items_updated_at ON party_inventory_items (updated_at DESC, id DESC);
