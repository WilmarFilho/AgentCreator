-- Tabela de Perfis Públicos
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  nome text,
  email text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Políticas de RLS
create policy "Perfis são visíveis por todos." on public.profiles
  for select using (true);

create policy "Usuários podem inserir seu próprio perfil." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Usuários podem atualizar o próprio perfil." on public.profiles
  for update using (auth.uid() = id);

-- Função para criar um perfil automaticamente após o cadastro (Triggers)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email, avatar_url)
  values (
    new.id, 
    new.raw_user_meta_data->>'nome', -- Pega o nome vindo do signup metadata
    new.email,
    new.raw_user_meta_data->>'avatar_url' -- Usado no caso do login do Google
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger disparado sempre que um novo usuário for inserido em auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
