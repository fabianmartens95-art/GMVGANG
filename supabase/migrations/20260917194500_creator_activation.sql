begin;

create table if not exists public.creator_activations (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  schema_version text not null default 'r3-v1.0' check (schema_version = 'r3-v1.0'),
  shipping_country text not null check (char_length(btrim(shipping_country)) between 2 and 80),
  disclosure_answer text not null check (disclosure_answer in ('use_disclosure','follower_threshold','product_link_replaces')),
  health_claim_answer text not null check (health_claim_answer in ('clarify_before_publish','publish_if_good','comments_only')),
  rights_answer text not null check (rights_answer in ('rights_required','always_allowed','music_only')),
  compliance_score integer not null check (compliance_score between 0 and 3),
  compliance_passed boolean not null,
  submitted_at timestamptz not null,
  updated_at timestamptz not null,
  constraint creator_activation_score_consistency check (
    compliance_score =
      (case when disclosure_answer = 'use_disclosure' then 1 else 0 end) +
      (case when health_claim_answer = 'clarify_before_publish' then 1 else 0 end) +
      (case when rights_answer = 'rights_required' then 1 else 0 end)
  ),
  constraint creator_activation_pass_consistency check (
    compliance_passed = (compliance_score = 3)
  )
);

create index if not exists creator_activations_updated_idx
  on public.creator_activations(updated_at desc);

alter table public.creator_activations enable row level security;
revoke all on public.creator_activations from anon, authenticated;
grant select, insert, update, delete on public.creator_activations to service_role;

commit;
