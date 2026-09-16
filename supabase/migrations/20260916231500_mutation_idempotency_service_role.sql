GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.mutation_idempotency
  TO service_role;

REVOKE ALL
  ON TABLE public.mutation_idempotency
  FROM anon, authenticated;
