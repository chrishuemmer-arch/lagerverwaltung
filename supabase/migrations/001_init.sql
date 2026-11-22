-- Zentrale Datenbank der Lagerverwaltung (Supabase/Postgres)

create table profile (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  freigegeben boolean not null default false,
  admin boolean not null default false,
  erstellt timestamptz not null default now()
);

create table lager (
  id bigint generated always as identity primary key,
  name text not null,
  verantwortlich uuid references profile on delete set null
);

create table orte (
  id bigint generated always as identity primary key,
  lager_id bigint not null references lager on delete cascade,
  name text not null,
  typ text not null check (typ in ('lager', 'kofferraum'))
);

create table plaetze (
  id bigint generated always as identity primary key,
  ort_id bigint not null references orte on delete cascade,
  regal text not null default '',
  nummer text not null,
  notiz text,
  unique (ort_id, regal, nummer)
);

create table projekte (
  id bigint generated always as identity primary key,
  name text not null,
  archiviert boolean not null default false
);

create table artikel (
  id bigint generated always as identity primary key,
  name text not null,
  kategorie text,
  mit_seriennummer boolean not null default false
);

create table kofferraum_soll (
  lager_id bigint not null references lager on delete cascade,
  artikel_id bigint not null references artikel on delete cascade,
  menge integer not null check (menge > 0),
  primary key (lager_id, artikel_id)
);

create table eintraege (
  id bigint generated always as identity primary key,
  artikel_id bigint not null references artikel on delete cascade,
  ort_id bigint not null references orte,
  platz_id bigint references plaetze,
  projekt_id bigint references projekte on delete set null,
  seriennummer text unique,
  menge integer not null check (menge > 0),
  notiz text,
  geaendert timestamptz not null default now()
);

create table bewegungen (
  id bigint generated always as identity primary key,
  zeit timestamptz not null default now(),
  typ text not null,
  artikel_id bigint not null references artikel on delete cascade,
  menge integer not null,
  seriennummer text,
  von_ort_id bigint references orte on delete set null,
  von_platz_id bigint references plaetze on delete set null,
  nach_ort_id bigint references orte on delete set null,
  nach_platz_id bigint references plaetze on delete set null,
  projekt_id bigint references projekte on delete set null,
  notiz text,
  user_id uuid default auth.uid() references profile on delete set null
);

create index on eintraege (artikel_id);
create index on bewegungen (artikel_id);

-- Rechte: Nur freigegebene Kollegen sehen und ändern Daten. Wer sich zuerst registriert, ist Admin.

create function ist_mitglied() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profile where id = auth.uid() and freigegeben) $$;

create function ist_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profile where id = auth.uid() and freigegeben and admin) $$;

create function neuer_nutzer() returns trigger language plpgsql security definer set search_path = public as $$
declare erster boolean := not exists (select 1 from profile);
begin
  insert into profile (id, name, freigegeben, admin)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), erster, erster);
  return new;
end $$;
create trigger neuer_nutzer after insert on auth.users for each row execute function neuer_nutzer();

create function profil_schutz() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not ist_admin() then
    new.freigegeben := old.freigegeben;
    new.admin := old.admin;
  end if;
  return new;
end $$;
create trigger profil_schutz before update on profile for each row execute function profil_schutz();

alter table profile enable row level security;
create policy lesen on profile for select to authenticated using (id = auth.uid() or ist_mitglied());
create policy aendern on profile for update to authenticated using (id = auth.uid() or ist_admin());

do $$
declare t text;
begin
  foreach t in array array['lager', 'orte', 'plaetze', 'projekte', 'artikel', 'kofferraum_soll', 'eintraege'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy mitglieder on %I for all to authenticated using (ist_mitglied()) with check (ist_mitglied())', t);
  end loop;
end $$;

alter table bewegungen enable row level security;
create policy lesen on bewegungen for select to authenticated using (ist_mitglied());
create policy schreiben on bewegungen for insert to authenticated with check (ist_mitglied() and user_id = auth.uid());

-- Lagerbewegungen als atomare Funktionen

create function lager_anlegen(p_name text) returns bigint language plpgsql set search_path = public as $$
declare v_id bigint;
begin
  insert into lager (name, verantwortlich) values (p_name, auth.uid()) returning id into v_id;
  insert into orte (lager_id, name, typ) values (v_id, 'Container', 'lager'), (v_id, 'Kofferraum', 'kofferraum');
  return v_id;
end $$;

create function pruefe_menge(p_menge integer) returns void language plpgsql as $$
begin
  if p_menge is null or p_menge < 1 then raise exception 'Menge muss eine ganze Zahl ab 1 sein'; end if;
end $$;

create function gleicher_eintrag(p_artikel bigint, p_ort bigint, p_platz bigint, p_projekt bigint, p_ausser bigint default null)
returns bigint language sql stable set search_path = public as $$
  select id from eintraege
  where artikel_id = p_artikel and seriennummer is null and ort_id = p_ort
    and platz_id is not distinct from p_platz and projekt_id is not distinct from p_projekt
    and id is distinct from p_ausser
  order by id limit 1
$$;

create function einlagern(p_artikel bigint, p_ort bigint, p_menge integer default 1, p_seriennummer text default null,
  p_platz bigint default null, p_projekt bigint default null, p_notiz text default null)
returns bigint language plpgsql set search_path = public as $$
declare
  a artikel;
  sn text := nullif(upper(trim(coalesce(p_seriennummer, ''))), '');
  v_id bigint;
begin
  select * into a from artikel where id = p_artikel;
  if not found then raise exception 'Artikel nicht gefunden'; end if;
  if a.mit_seriennummer and sn is null then raise exception 'Seriennummer fehlt'; end if;
  if sn is not null then
    if exists (select 1 from eintraege where seriennummer = sn) then
      raise exception 'Seriennummer % ist schon im Bestand', sn;
    end if;
    insert into eintraege (artikel_id, ort_id, platz_id, projekt_id, seriennummer, menge, notiz)
    values (p_artikel, p_ort, p_platz, p_projekt, sn, 1, nullif(p_notiz, '')) returning id into v_id;
  else
    perform pruefe_menge(p_menge);
    v_id := gleicher_eintrag(p_artikel, p_ort, p_platz, p_projekt);
    if v_id is not null then
      update eintraege set menge = menge + p_menge, geaendert = now() where id = v_id;
    else
      insert into eintraege (artikel_id, ort_id, platz_id, projekt_id, menge, notiz)
      values (p_artikel, p_ort, p_platz, p_projekt, p_menge, nullif(p_notiz, '')) returning id into v_id;
    end if;
  end if;
  insert into bewegungen (typ, artikel_id, menge, seriennummer, nach_ort_id, nach_platz_id, projekt_id, notiz)
  values ('einlagern', p_artikel, case when sn is null then p_menge else 1 end, sn, p_ort, p_platz, p_projekt, nullif(p_notiz, ''));
  return v_id;
end $$;

create function entnehmen(p_eintrag bigint, p_menge integer, p_notiz text default null)
returns void language plpgsql set search_path = public as $$
declare e eintraege; m integer;
begin
  perform pruefe_menge(p_menge);
  select * into e from eintraege where id = p_eintrag for update;
  if not found then raise exception 'Eintrag nicht gefunden'; end if;
  m := least(p_menge, e.menge);
  if m >= e.menge then delete from eintraege where id = e.id;
  else update eintraege set menge = menge - m, geaendert = now() where id = e.id;
  end if;
  insert into bewegungen (typ, artikel_id, menge, seriennummer, von_ort_id, von_platz_id, projekt_id, notiz)
  values ('entnehmen', e.artikel_id, m, e.seriennummer, e.ort_id, e.platz_id, e.projekt_id, nullif(p_notiz, ''));
end $$;

create function umlagern(p_eintrag bigint, p_menge integer, p_ort bigint, p_platz bigint default null,
  p_projekt bigint default null, p_notiz text default null)
returns void language plpgsql set search_path = public as $$
declare e eintraege; m integer; g bigint;
begin
  perform pruefe_menge(p_menge);
  select * into e from eintraege where id = p_eintrag for update;
  if not found then raise exception 'Eintrag nicht gefunden'; end if;
  m := least(p_menge, e.menge);
  if e.seriennummer is null then g := gleicher_eintrag(e.artikel_id, p_ort, p_platz, p_projekt, e.id); end if;
  if e.seriennummer is not null or m >= e.menge then
    if g is not null then
      update eintraege set menge = menge + e.menge, geaendert = now() where id = g;
      delete from eintraege where id = e.id;
    else
      update eintraege set ort_id = p_ort, platz_id = p_platz, projekt_id = p_projekt, geaendert = now() where id = e.id;
    end if;
  else
    update eintraege set menge = menge - m, geaendert = now() where id = e.id;
    if g is not null then
      update eintraege set menge = menge + m, geaendert = now() where id = g;
    else
      insert into eintraege (artikel_id, ort_id, platz_id, projekt_id, menge, notiz)
      values (e.artikel_id, p_ort, p_platz, p_projekt, m, e.notiz);
    end if;
  end if;
  insert into bewegungen (typ, artikel_id, menge, seriennummer, von_ort_id, von_platz_id, nach_ort_id, nach_platz_id, projekt_id, notiz)
  values ('umlagern', e.artikel_id, m, e.seriennummer, e.ort_id, e.platz_id, p_ort, p_platz, p_projekt, nullif(p_notiz, ''));
end $$;

alter publication supabase_realtime add table profile, lager, orte, plaetze, projekte, artikel, kofferraum_soll, eintraege, bewegungen;
