DROP TRIGGER IF EXISTS on_company_created ON public.companies;

CREATE TRIGGER on_company_created
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_company();

DROP POLICY IF EXISTS "creators can view their companies" ON public.companies;

CREATE POLICY "creators can view their companies"
ON public.companies
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);