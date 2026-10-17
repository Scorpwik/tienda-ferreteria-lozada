-- Los id_origen del sistema de facturación (ej. 3184077644) no caben en
-- integer (máx 2147483647). bigint evita el error 22003 al importar.
alter table public.products
  alter column origin_id type bigint using origin_id::bigint;

alter table public.product_variants
  alter column origin_id type bigint using origin_id::bigint;

create or replace function public.search_product_ids(
  p_query text default null,
  p_category_ids uuid[] default null,
  p_availability text default null,
  p_only_offers boolean default false,
  p_only_bestsellers boolean default false,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (product_id uuid, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as term,
      least(greatest(coalesce(p_limit, 24), 1), 60) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  matched as (
    select p.id, p.name, p.is_bestseller
    from public.products p
    cross join params pr
    where (p_category_ids is null or p.category_id = any (p_category_ids))
      and (not coalesce(p_only_offers, false) or p.is_offer)
      and (not coalesce(p_only_bestsellers, false) or p.is_bestseller)
      and (
        pr.term is null
        or p.name ilike '%' || pr.term || '%'
        or p.description ilike '%' || pr.term || '%'
        or (pr.term ~ '^[0-9]{1,18}$' and p.origin_id = pr.term::bigint)
        or exists (
          select 1
          from public.product_variants v
          where v.product_id = p.id
            and (
              v.size ilike '%' || pr.term || '%'
              or v.barcode ilike '%' || pr.term || '%'
              or (pr.term ~ '^[0-9]{1,18}$' and v.origin_id = pr.term::bigint)
            )
        )
      )
      and (
        p_availability is null
        or exists (
          select 1
          from public.product_variants v2
          where v2.product_id = p.id
            and v2.availability = p_availability
        )
      )
      and (
        (p_price_min is null and p_price_max is null)
        or exists (
          select 1
          from public.product_variants v3
          where v3.product_id = p.id
            and v3.availability <> 'consultar'
            and v3.price > 0
            and (p_price_min is null or v3.price >= p_price_min)
            and (p_price_max is null or v3.price <= p_price_max)
        )
      )
  )
  select m.id, count(*) over () as total
  from matched m
  cross join params pr
  order by
    case
      when pr.term is null then 0
      when m.name ilike pr.term || '%' then 0
      else 1
    end,
    m.is_bestseller desc,
    m.name
  limit (select lim from params)
  offset (select off from params);
$$;

grant execute on function public.search_product_ids(
  text, uuid[], text, boolean, boolean, numeric, numeric, integer, integer
) to anon, authenticated;
