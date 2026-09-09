-- Read-only PostgreSQL numeric parity for discardPreview.test.ts.
-- Same multiplication as sales_waste_breakdown's volume_delta * day_unit_price;
-- this tests preview arithmetic, not a simulated successful E2 write.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      (120::numeric, 28::numeric, 3360::numeric),
      (120, 4, 480), (0.1, 0.2, 0.02), (2, 500, 1000), (0, 28, 0), (12, 0, 0)
    ) AS fixture(quantity, price, expected)
    WHERE quantity * price <> expected
  ) THEN RAISE EXCEPTION 'discard preview numeric parity failed'; END IF;
END $$;
