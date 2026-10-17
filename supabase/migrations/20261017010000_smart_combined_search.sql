-- Busqueda combinada: cada palabra puede caer en un campo distinto.
-- "amoladora 9 pulgadas" cruza nombre + medida; "spray blanco" cruza nombre + color.

create or replace function public.search_fold(raw text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(
    coalesce(raw, ''),
    'áàäâéèëêíìïîóòöôúùüûñÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑçÇ',
    'aaaaeeeeiiiioooouuuunAAAAEEEEIIIIOOOOUUUUNcC'
  ));
$$;

create or replace function public.search_normalize(raw text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  t text;
begin
  t := public.search_fold(raw);

  -- 9" / 9″ → 9 pulg, para que coincida con "9 pulgadas"
  t := regexp_replace(t, '(\d)\s*["″]+', '\1 pulg', 'g');

  t := regexp_replace(t, '(^|[^a-z0-9])(pulgadas|pulgada|pulg|inches|inch|in)([^a-z0-9]|$)', '\1pulg\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(milimetros|milimetro|mms?)([^a-z0-9]|$)', '\1mm\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(centimetros|centimetro|cms?)([^a-z0-9]|$)', '\1cm\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(galones|galon|gals?)([^a-z0-9]|$)', '\1galon\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(litros|litro|lts?)([^a-z0-9]|$)', '\1litro\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(inalambricas|inalambricos|inalambrica|inalambrico)([^a-z0-9]|$)', '\1inalambrica\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(blancas|blancos|blanca|blanco)([^a-z0-9]|$)', '\1blanco\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(negras|negros|negra|negro)([^a-z0-9]|$)', '\1negro\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(rojas|rojos|roja|rojo)([^a-z0-9]|$)', '\1rojo\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(amarillas|amarillos|amarilla|amarillo)([^a-z0-9]|$)', '\1amarillo\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(verdes|verde)([^a-z0-9]|$)', '\1verde\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(azules|azul)([^a-z0-9]|$)', '\1azul\3', 'g');
  t := regexp_replace(t, '(^|[^a-z0-9])(grises|gris)([^a-z0-9]|$)', '\1gris\3', 'g');

  t := regexp_replace(t, '[^a-z0-9./-]+', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  return btrim(t);
end;
$$;

create or replace function public.search_tokens(raw text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(token), '{}'::text[])
  from (
    select token
    from unnest(regexp_split_to_array(public.search_normalize(raw), '\s+')) as token
    where token <> ''
      and token not in (
        'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'uno',
        'y', 'o', 'para', 'con', 'en', 'a', 'al', 'por', 'que', 'the', 'of'
      )
  ) tokens;
$$;

create or replace function public.search_token_matches(doc text, token text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  escaped text;
begin
  if token is null or token = '' then
    return true;
  end if;

  escaped := regexp_replace(token, '([.\\[\]()*+?^${}|])', '\\\1', 'g');

  -- Numeros y tokens cortos: evitan que "9" coincida con "900w" o un codigo.
  if token ~ '^[0-9./-]+$' or char_length(token) <= 2 then
    return doc ~ ('(^|[^a-z0-9])' || escaped || '([^0-9]|$)');
  end if;

  -- Texto: "amol" encuentra "amoladora", "blanc" encuentra "blanco".
  return doc ~ ('(^|[^a-z0-9])' || escaped);
end;
$$;

create or replace function public.search_all_tokens_match(doc text, tokens text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    tokens is null
    or cardinality(tokens) = 0
    or not exists (
      select 1
      from unnest(tokens) as token
      where not public.search_token_matches(doc, token)
    );
$$;

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
      public.search_tokens(p_query) as tokens,
      least(greatest(coalesce(p_limit, 24), 1), 60) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  matched as (
    select
      p.id,
      p.name,
      p.is_bestseller,
      public.search_normalize(p.name) as name_norm,
      pr.term,
      pr.tokens
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.categories parent on parent.id = c.parent_id
    cross join params pr
    where (p_category_ids is null or p.category_id = any (p_category_ids))
      and (not coalesce(p_only_offers, false) or p.is_offer)
      and (not coalesce(p_only_bestsellers, false) or p.is_bestseller)
      and (
        pr.term is null
        or (
          cardinality(pr.tokens) > 0
          and public.search_all_tokens_match(
            public.search_normalize(concat_ws(
              ' ',
              p.name,
              p.description,
              array_to_string(p.search_tags, ' '),
              c.name,
              parent.name,
              p.origin_id::text,
              (
                select string_agg(
                  concat_ws(
                    ' ',
                    v.size,
                    v.color,
                    v.presentation,
                    v.sale_unit,
                    v.barcode,
                    v.origin_id::text
                  ),
                  ' '
                )
                from public.product_variants v
                where v.product_id = p.id
              )
            )),
            pr.tokens
          )
        )
        or (
          cardinality(pr.tokens) = 0
          and public.search_normalize(concat_ws(' ', p.name, p.description))
            like '%' || public.search_normalize(pr.term) || '%'
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
  order by
    case
      when m.term is null then 0
      when public.search_all_tokens_match(m.name_norm, m.tokens) then 0
      when cardinality(m.tokens) > 0
        and public.search_token_matches(m.name_norm, m.tokens[1]) then 1
      else 2
    end,
    m.is_bestseller desc,
    m.name
  limit (select lim from params)
  offset (select off from params);
$$;

grant execute on function public.search_fold(text) to anon, authenticated;
grant execute on function public.search_normalize(text) to anon, authenticated;
grant execute on function public.search_tokens(text) to anon, authenticated;
grant execute on function public.search_token_matches(text, text) to anon, authenticated;
grant execute on function public.search_all_tokens_match(text, text[]) to anon, authenticated;
grant execute on function public.search_product_ids(
  text, uuid[], text, boolean, boolean, numeric, numeric, integer, integer
) to anon, authenticated;
