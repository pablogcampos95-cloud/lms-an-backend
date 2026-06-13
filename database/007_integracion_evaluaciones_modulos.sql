-- Integra evaluaciones existentes en el orden de pasos de cada modulo.
-- Ejecutar una vez despues de 006_evaluaciones_foros.sql.

alter table public.evaluaciones
  add column if not exists orden integer;

-- Conserva el orden de los pasos y agrega las evaluaciones existentes al final.
with ranked as (
  select e.id,
         coalesce((select max(l.orden) from public.lecciones l where l.modulo_id = e.modulo_id), 0)
           + row_number() over (partition by e.modulo_id order by e.created_at nulls last, e.id) as nuevo_orden
  from public.evaluaciones e
  where e.modulo_id is not null and e.orden is null
)
update public.evaluaciones e
set orden = ranked.nuevo_orden
from ranked
where e.id = ranked.id;

create index if not exists evaluaciones_modulo_orden_idx
  on public.evaluaciones(modulo_id, orden);

notify pgrst, 'reload schema';
