-- GMVGANG Referral Rewards persistence boundary.
-- PENDING ONLY: do not apply to production without an explicit activation decision,
-- schema verification and an approval/payout lifecycle review.

create table if not exists public.referral_rewards (
  id uuid primary key,
  referral_attribution_id uuid not null references public.referral_attributions(id) on delete restrict,
  event text not null check (event in ('qualified', 'contracted', 'first_qualified_performance', 'manual_bonus')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected', 'void')),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (referral_attribution_id, event),
  check (status <> 'paid' or paid_at is not null),
  check (paid_at is null or approved_at is not null)
);

create index if not exists referral_rewards_attribution_idx
  on public.referral_rewards(referral_attribution_id);

create index if not exists referral_rewards_status_idx
  on public.referral_rewards(status);

create or replace trigger referral_rewards_updated_at
before update on public.referral_rewards
for each row execute function private.set_updated_at();

alter table public.referral_rewards enable row level security;

-- Browser/authenticated clients receive no direct reward-table access.
-- Reward evaluation and any future approval/payout lifecycle stay server-only.
revoke all on table public.referral_rewards from anon, authenticated;
