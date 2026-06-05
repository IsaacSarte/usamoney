
-- Enums
CREATE TYPE public.tx_kind AS ENUM ('income', 'expense');
CREATE TYPE public.recur_freq AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- auto-create profile + seed default categories on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.categories (user_id, name, kind) VALUES
    (NEW.id, 'Salary', 'income'),
    (NEW.id, 'Freelance', 'income'),
    (NEW.id, 'Gifts', 'income'),
    (NEW.id, 'Food', 'expense'),
    (NEW.id, 'Transport', 'expense'),
    (NEW.id, 'Bills', 'expense'),
    (NEW.id, 'Shopping', 'expense'),
    (NEW.id, 'Entertainment', 'expense'),
    (NEW.id, 'Health', 'expense'),
    (NEW.id, 'Others', 'expense');
  RETURN NEW;
END; $$;

-- categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.tx_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.categories (user_id, kind);

-- transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.tx_kind NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  occurred_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.transactions (user_id, occurred_on DESC);
CREATE INDEX ON public.transactions (user_id, category_id);

-- budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  monthly_limit NUMERIC(14,2) NOT NULL CHECK (monthly_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- recurring rules
CREATE TABLE public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.tx_kind NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency public.recur_freq NOT NULL,
  start_on DATE NOT NULL,
  end_on DATE,
  next_run_on DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_rules TO authenticated;
GRANT ALL ON public.recurring_rules TO service_role;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring" ON public.recurring_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- vault meta (one row per user, holds salt + verifier)
CREATE TABLE public.vault_meta (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  verifier_iv TEXT NOT NULL,
  verifier_ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_meta TO authenticated;
GRANT ALL ON public.vault_meta TO service_role;
ALTER TABLE public.vault_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vault meta" ON public.vault_meta FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- vault items (server only stores ciphertext)
CREATE TABLE public.vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'note',
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_items TO authenticated;
GRANT ALL ON public.vault_items TO service_role;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vault items" ON public.vault_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.vault_items (user_id, created_at DESC);
CREATE TRIGGER vault_items_set_updated_at BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger after profiles + categories tables exist
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
