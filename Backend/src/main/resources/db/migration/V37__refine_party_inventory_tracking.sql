ALTER TABLE party_inventory_items
    ADD COLUMN IF NOT EXISTS carrier_character_id BIGINT REFERENCES characters(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_party_inventory_items_carrier_character_id ON party_inventory_items (carrier_character_id);

DO $$
BEGIN
    ALTER TABLE party_inventory_items
        ADD CONSTRAINT chk_party_inventory_items_kind
            CHECK (kind IN ('catalog-item', 'custom-item'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE party_inventory_items
        ADD CONSTRAINT chk_party_inventory_items_quantity
            CHECK (quantity > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE party_inventory_balance
        ADD CONSTRAINT chk_party_inventory_balance_copper
            CHECK (copper >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE party_inventory_balance
        ADD CONSTRAINT chk_party_inventory_balance_silver
            CHECK (silver >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE party_inventory_balance
        ADD CONSTRAINT chk_party_inventory_balance_gold
            CHECK (gold >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE party_inventory_balance
        ADD CONSTRAINT chk_party_inventory_balance_platinum
            CHECK (platinum >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
