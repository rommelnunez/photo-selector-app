-- Galleries
create table galleries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  password_hash text not null,
  cover_url text,
  status text not null default 'draft',
  created_at timestamptz default now()
);

-- Photos
create table photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references galleries(id) on delete cascade,
  blob_url text not null,
  filename text not null,
  position int not null,
  created_at timestamptz default now()
);

create index idx_photos_gallery on photos(gallery_id, position);

-- Selections
create table selections (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references galleries(id) on delete cascade,
  photo_id uuid references photos(id) on delete cascade,
  comment text,
  submitted_at timestamptz default now()
);

create index idx_selections_gallery on selections(gallery_id);
