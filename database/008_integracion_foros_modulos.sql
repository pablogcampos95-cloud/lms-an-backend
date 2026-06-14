-- Integra los foros existentes en el orden unico de cada modulo.
-- Ejecutar una vez despues de 007_integracion_evaluaciones_modulos.sql.

alter table public.foros_evaluables
  add column if not exists orden integer;

-- Coloca los foros existentes despues de pasos y evaluaciones ya ordenados.
with ranked as (
  select f.id,
         greatest(
           coalesce((select max(l.orden) from public.lecciones l where l.modulo_id = f.modulo_id), 0),
           coalesce((select max(e.orden) from public.evaluaciones e where e.modulo_id = f.modulo_id), 0)
         ) + row_number() over (partition by f.modulo_id order by f.created_at nulls last, f.id) as nuevo_orden
  from public.foros_evaluables f
  where f.modulo_id is not null and f.orden is null
)
update public.foros_evaluables f
set orden = ranked.nuevo_orden
from ranked
where f.id = ranked.id;

create index if not exists foros_modulo_orden_idx
  on public.foros_evaluables(modulo_id, orden);

notify pgrst, 'reload schema';
