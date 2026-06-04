-- Add temperature and max_tokens to ai_settings
alter table public.ai_settings
  add column if not exists temperature double precision not null default 0.7,
  add column if not exists max_tokens  integer         not null default 4096;
