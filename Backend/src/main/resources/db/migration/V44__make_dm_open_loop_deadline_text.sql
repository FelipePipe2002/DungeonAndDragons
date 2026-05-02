ALTER TABLE dm_open_loops
    ALTER COLUMN due_at TYPE VARCHAR(200)
    USING CASE
        WHEN due_at IS NULL THEN NULL
        ELSE due_at::text
    END;
