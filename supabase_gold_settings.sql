create table if not exists public.gold_settings (
    id integer primary key,
    precio_contado_nacional numeric(12, 2) not null default 0,
    precio_pagos_nacional numeric(12, 2) not null default 0,
    costo_nacional numeric(12, 2) not null default 0,
    costo_fundicion numeric(12, 2) not null default 7500,
    precio_contado_italiano numeric(12, 2) not null default 0,
    precio_pagos_italiano numeric(12, 2) not null default 0,
    costo_italiano numeric(12, 2) not null default 0,
    updated_at timestamptz not null default now(),
    constraint gold_settings_single_row check (id = 1)
);

alter table public.gold_settings
    add column if not exists costo_fundicion numeric(12, 2) not null default 7500;

alter table public.gold_settings disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.gold_settings to anon, authenticated;

insert into public.gold_settings (
    id,
    precio_contado_nacional,
    precio_pagos_nacional,
    costo_nacional,
    costo_fundicion,
    precio_contado_italiano,
    precio_pagos_italiano,
    costo_italiano
)
values (
    1,
    50000,
    70000,
    36000,
    7500,
    50000,
    70000,
    44000
)
on conflict (id) do update set
    precio_contado_nacional = excluded.precio_contado_nacional,
    precio_pagos_nacional = excluded.precio_pagos_nacional,
    costo_nacional = excluded.costo_nacional,
    costo_fundicion = excluded.costo_fundicion,
    precio_contado_italiano = excluded.precio_contado_italiano,
    precio_pagos_italiano = excluded.precio_pagos_italiano,
    costo_italiano = excluded.costo_italiano,
    updated_at = now();

create table if not exists public.renewal_settings (
    id integer primary key,
    costo_fundir numeric(12, 2) not null default 7500,
    precio_financiado_fundir numeric(12, 2) not null default 12000,
    precio_contado_fundir numeric(12, 2) not null default 10000,
    updated_at timestamptz not null default now(),
    constraint renewal_settings_single_row check (id = 1)
);

alter table public.renewal_settings
    add column if not exists precio_contado_fundir numeric(12, 2) not null default 10000;

alter table public.renewal_settings disable row level security;

grant select, insert, update on public.renewal_settings to anon, authenticated;

insert into public.renewal_settings (
    id,
    costo_fundir,
    precio_financiado_fundir,
    precio_contado_fundir
)
values (
    1,
    7500,
    12000,
    10000
)
on conflict (id) do update set
    costo_fundir = excluded.costo_fundir,
    precio_financiado_fundir = excluded.precio_financiado_fundir,
    precio_contado_fundir = excluded.precio_contado_fundir,
    updated_at = now();
