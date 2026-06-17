import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { detectCountry } from "@/lib/payments.functions";
import type { Currency } from "@/data/predictions";

interface CurrencyState {
  currency: Currency;
  country: string;
  isNigeria: boolean;
  manual: boolean;
  setCurrency: (c: Currency) => void;
}

const CurrencyContext = createContext<CurrencyState>({
  currency: "KES",
  country: "KE",
  isNigeria: false,
  manual: false,
  setCurrency: () => {},
});

const STORAGE_KEY = "tk-currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const detect = useServerFn(detectCountry);
  const [manual, setManual] = useState<Currency | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "NGN" || stored === "KES") setManual(stored);
  }, []);

  const { data } = useQuery({
    queryKey: ["geo-currency"],
    queryFn: () => detect(),
    staleTime: 60 * 60 * 1000,
  });

  const setCurrency = (c: Currency) => {
    setManual(c);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, c);
  };

  const currency: Currency = manual ?? data?.currency ?? "KES";

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        country: data?.country ?? "KE",
        isNigeria: currency === "NGN",
        manual: manual !== null,
        setCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
