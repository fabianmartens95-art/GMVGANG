DO $$
DECLARE
  rls_enabled BOOLEAN;
  has_primary_key BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE oid = 'public.mutation_idempotency'::regclass;

  IF rls_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'mutation_idempotency must have RLS enabled';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.mutation_idempotency'::regclass
      AND contype = 'p'
  ) INTO has_primary_key;

  IF has_primary_key IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'mutation_idempotency primary key missing';
  END IF;

  IF has_table_privilege('anon', 'public.mutation_idempotency', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'anon must not have mutation_idempotency table privileges';
  END IF;

  IF has_table_privilege('authenticated', 'public.mutation_idempotency', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated must not have mutation_idempotency table privileges';
  END IF;
END $$;
