-- Adiciona coluna de status de aprovação para perfis de médico.
-- Execute no PostgreSQL (AWS RDS ou local).

alter table public.doctor_profiles
    add column if not exists approval_status text not null default 'approved';

-- Médicos existentes são considerados aprovados para não interromper o fluxo atual.
update public.doctor_profiles
set approval_status = 'approved'
where approval_status is null or approval_status = '';

