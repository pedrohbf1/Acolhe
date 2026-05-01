export type MaskType = "numero" | "numeric" | "cpf" | "cnpj" | "cpfCnpj" | "telefone" | "titleCase" | "price" | "date" | "cep" | "uf" | "placa" | "uppercase";

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function maskNumero(value: string) {
  return digits(value);
}

function maskCpf(value: string) {
  const d = digits(value).slice(0, 11);
  const n = d.length;
  if (n <= 3) return d;
  if (n <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (n <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskCnpj(value: string) {
  const d = digits(value).slice(0, 14);
  const n = d.length;
  if (n <= 2) return d;
  if (n <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (n <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (n <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCpfCnpj(value: string) {
  const d = digits(value);
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d);
}

function maskTelefone(value: string) {
  const d = digits(value).slice(0, 11);
  const n = d.length;
  if (n === 0) return "";
  if (n <= 2) return `(${d}`;
  if (n <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (n <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

function maskPrice(value: string) {
  const d = digits(value).slice(0, 13); // até 99.999.999.999,99
  if (!d) return "";
  const n = parseInt(d, 10);
  return (n / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function maskNumeric(value: string) {
  return digits(value);
}

function maskDate(value: string) {
  const d = digits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function maskCep(value: string) {
  const d = digits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function maskUf(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

function maskPlaca(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7);
}

function maskTitleCase(value: string) {
  return value.replace(/\S+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  );
}

export function validateCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = d.slice(0, len).split("").reduce((acc, n, i) => acc + Number(n) * w[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function validateCpf(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;

  const calc = (len: number) => {
    const sum = d
      .slice(0, len)
      .split("")
      .reduce((acc, n, i) => acc + Number(n) * (len + 1 - i), 0);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };

  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function applyMask(value: string, mask: MaskType): string {
  switch (mask) {
    case "numero":   return maskNumero(value);
    case "numeric":  return maskNumeric(value);
    case "date":     return maskDate(value);
    case "cpf":      return maskCpf(value);
    case "cnpj":     return maskCnpj(value);
    case "cpfCnpj":  return maskCpfCnpj(value);
    case "telefone": return maskTelefone(value);
    case "titleCase": return maskTitleCase(value);
    case "price":     return maskPrice(value);
    case "cep":       return maskCep(value);
    case "uf":        return maskUf(value);
    case "placa":     return maskPlaca(value);
    case "uppercase": return value.toUpperCase();
    default:          return value;
  }
}
