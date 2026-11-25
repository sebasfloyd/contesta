-- Contesta: esquema inicial.
-- Se aplica con `npm run migrar` (lee DATABASE_URL). Sirve igual para Supabase y para la base local de pruebas.

create table if not exists ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now()
);

create table if not exists automatizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activa boolean not null default false,
  disparador jsonb not null,
  pasos jsonb not null default '[]'::jsonb,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);

create table if not exists contactos (
  id uuid primary key default gen_random_uuid(),
  canal text not null,
  id_externo text not null,
  usuario text,
  nombre text,
  etiquetas jsonb not null default '[]'::jsonb,
  datos jsonb not null default '{}'::jsonb,
  origen_automatizacion_id uuid references automatizaciones(id) on delete set null,
  bot_pausado boolean not null default false,
  baja boolean not null default false,
  pide_humano boolean not null default false,
  ultimo_entrante timestamptz,
  ultimo_movimiento timestamptz not null default now(),
  creado timestamptz not null default now(),
  unique (canal, id_externo)
);
create index if not exists contactos_movimiento on contactos (ultimo_movimiento desc);

-- Cada comentario o mensaje que entra. La clave única (canal, id_externo) es la que
-- impide responder dos veces lo mismo.
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  canal text not null,
  id_externo text not null,
  tipo text not null,
  contacto_id uuid references contactos(id) on delete cascade,
  texto text not null default '',
  post_id text,
  ocurrido timestamptz not null,
  recibido timestamptz not null default now(),
  privado_enviado boolean not null default false,
  resultado text,
  unique (canal, id_externo)
);

-- Una corrida de una automatización para un evento.
create table if not exists ejecuciones (
  id uuid primary key default gen_random_uuid(),
  automatizacion_id uuid not null references automatizaciones(id) on delete cascade,
  contacto_id uuid not null references contactos(id) on delete cascade,
  evento_id uuid not null references eventos(id) on delete cascade,
  estado text not null,
  paso_actual integer not null default 0,
  reanudar_en timestamptz,
  contexto jsonb not null default '{}'::jsonb,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  unique (automatizacion_id, evento_id)
);
create index if not exists ejecuciones_pendientes on ejecuciones (estado, reanudar_en);
create index if not exists ejecuciones_contacto on ejecuciones (contacto_id, estado);

-- Todo lo que entra y sale: sirve de bandeja y de registro de envíos.
create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id) on delete cascade,
  direccion text not null,
  tipo text not null,
  texto text not null default '',
  opciones jsonb,
  origen text not null,
  automatizacion_id uuid references automatizaciones(id) on delete set null,
  ejecucion_id uuid references ejecuciones(id) on delete set null,
  id_externo text,
  estado text not null,
  error text,
  creado timestamptz not null default now()
);
create index if not exists mensajes_contacto on mensajes (contacto_id, creado);
create index if not exists mensajes_salientes on mensajes (direccion, origen, creado);

create table if not exists registro (
  id uuid primary key default gen_random_uuid(),
  nivel text not null,
  tipo text not null,
  detalle text not null default '',
  automatizacion_id uuid references automatizaciones(id) on delete cascade,
  contacto_id uuid references contactos(id) on delete cascade,
  creado timestamptz not null default now()
);
create index if not exists registro_creado on registro (creado desc);
create index if not exists registro_automatizacion on registro (automatizacion_id, tipo);

-- Supabase publica el esquema "public" por su API. Con la seguridad por filas prendida
-- y sin políticas, nadie puede leer estas tablas con la clave pública: solo el panel,
-- que entra con la conexión directa a la base.
alter table ajustes enable row level security;
alter table automatizaciones enable row level security;
alter table contactos enable row level security;
alter table eventos enable row level security;
alter table ejecuciones enable row level security;
alter table mensajes enable row level security;
alter table registro enable row level security;
