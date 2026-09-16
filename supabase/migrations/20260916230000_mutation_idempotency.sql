CREATE TABLE IF NOT EXISTS public.mutation_idempotency (
  scope TEXT NOT NULL,
  subject TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  state TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
  response_status INTEGER CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, subject, idempotency_key),
  CHECK (
    (state = 'pending' AND response_status IS NULL AND completed_at IS NULL)
    OR
    (state = 'completed' AND response_status IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mutation_idempotency_expiry_idx
  ON public.mutation_idempotency (expires_at);

ALTER TABLE public.mutation_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mutation_idempotency FROM anon, authenticated;

COMMENT ON TABLE public.mutation_idempotency IS
  'Server-only replay protection for critical GMVGANG mutations. Responses are retained only for short-lived idempotent replay.';
