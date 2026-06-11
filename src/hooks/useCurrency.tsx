import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { detectCountry } from "@/lib/payments.functions";
import type { Currency } from "@/data/predictions";

export function useCurrency() {
  const detect = useServerFn(detectCountry);
  const { data } = useQuery({
    queryKey: ["geo-currency"],
    queryFn: () => detect(),
    staleTime: 60 * 60 * 1000,
  });
  const currency: Currency = data?.currency ?? "KES";
  return { currency, country: data?.country ?? "KE", isNigeria: currency === "NGN" };
}
