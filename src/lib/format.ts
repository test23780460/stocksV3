export const currency = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits
  }).format(value);

export const compactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);

export const percent = (value: number, digits = 2) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;

export const signedNumber = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

export const formatDateTime = (iso: string, includeTime = true) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short"
        }
      : {})
  }).format(date);
};

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

