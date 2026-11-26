-- Restrict VIP predictions from public exposure
/*DROP POLICY IF EXISTS "Anyone can view predictions" ON public.predictions;

CREATE POLICY "Public can view free predictions"
  ON public.predictions FOR SELECT
  TO anon, authenticated
  USING (vip = false);

CREATE POLICY "Admins can view all predictions"
  ON public.predictions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));*/

-- Remove the old, restrictive policies
DROP POLICY IF EXISTS "Public can view free predictions"     ON public.predictions;
DROP POLICY IF EXISTS "Admins can view all predictions"      ON public.predictions;
DROP POLICY IF EXISTS "Subscribers can view all predictions" ON public.predictions;

-- New: everyone (anon + authenticated) can read every row, VIP included
CREATE POLICY "Anyone can view all predictions"
  ON public.predictions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Lock down execution of the SECURITY DEFINER role-check function
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;