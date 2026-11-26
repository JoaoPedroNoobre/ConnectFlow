begin;

alter table public.atendimentos add column canal text not null default 'interno'
  check (canal in ('interno', 'whatsapp'));
alter table public.atendimentos add column revisao_ia bigint not null default 0;
alter table public.mensagens
  add column whatsapp_id text unique,
  add column entrega text check (entrega in ('enviando', 'aceita', 'enviada', 'entregue', 'lida', 'falha', 'incerta'));
grant update (whatsapp_id, entrega) on public.mensagens to service_role;

create table public.whatsapp_config (
  empresa_id bigint primary key references public.empresas(id),
  ativa boolean not null default false,
  agente jsonb not null default '{}',
  empresa jsonb not null default '{}',
  revisao bigint not null default 0
);
alter table public.whatsapp_config enable row level security;
revoke all on public.whatsapp_config from public, anon, authenticated;
grant select, insert, update on public.whatsapp_config to service_role;

-- A transação liga o webhook à mensagem antes de admitir uma resposta.
create function public.receber_whatsapp(p_empresa bigint, p_telefone text, p_nome text, p_id text, p_texto text)
returns table (atendimento_id text) language plpgsql security invoker set search_path = '' as $$
declare v_cliente bigint; v_atendimento bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('whatsapp:' || p_empresa::text, 0));
  if exists (select 1 from public.mensagens where whatsapp_id = p_id) then return; end if;
  select id into v_cliente from public.clientes
    where empresa_id = p_empresa and telefone = p_telefone order by id limit 1;
  if v_cliente is null then
    insert into public.clientes (empresa_id, telefone, nome)
      values (p_empresa, p_telefone, p_nome) returning id into v_cliente;
  end if;
  select id into v_atendimento from public.atendimentos
    where cliente_id = v_cliente and canal = 'whatsapp' and status <> 'resolvido' order by id desc limit 1;
  if v_atendimento is null then
    insert into public.atendimentos (cliente_id, canal, status)
      values (v_cliente, 'whatsapp', 'ia_atendendo') returning id into v_atendimento;
  end if;
  insert into public.mensagens (atendimento_id, autor, texto, whatsapp_id)
    values (v_atendimento, 'cliente', p_texto, p_id);
  return query select v_atendimento::text;
end;
$$;
revoke all on function public.receber_whatsapp(bigint,text,text,text,text) from public, anon, authenticated;
grant execute on function public.receber_whatsapp(bigint,text,text,text,text) to service_role;
commit;
