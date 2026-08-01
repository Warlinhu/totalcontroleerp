// Validação e consulta de documentos brasileiros (CPF/CNPJ).
// A consulta usa a BrasilAPI (gratuita, sem chave).

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function maskDocument(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function isValidCPF(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function isValidCNPJ(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export type DocumentKind = "cpf" | "cnpj" | "invalid" | "empty";

export function classifyDocument(value: string): DocumentKind {
  const d = onlyDigits(value);
  if (!d) return "empty";
  if (d.length === 11) return isValidCPF(d) ? "cpf" : "invalid";
  if (d.length === 14) return isValidCNPJ(d) ? "cnpj" : "invalid";
  return "invalid";
}

export type CnpjInfo = {
  razao_social: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
};

export async function fetchCnpjInfo(value: string): Promise<CnpjInfo> {
  const cnpj = onlyDigits(value);
  if (!isValidCNPJ(cnpj)) throw new Error("CNPJ inválido");
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
  if (!res.ok) throw new Error("Não foi possível consultar o CNPJ agora");
  const data = (await res.json()) as Record<string, unknown>;
  const ddd = (data["ddd_telefone_1"] as string) ?? "";
  return {
    razao_social: (data["razao_social"] as string) ?? "",
    nome_fantasia: (data["nome_fantasia"] as string) || null,
    email: (data["email"] as string) || null,
    telefone: ddd || null,
    situacao: (data["descricao_situacao_cadastral"] as string) || null,
    municipio: (data["municipio"] as string) || null,
    uf: (data["uf"] as string) || null,
  };
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export const isValidPhone = (v: string) => {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
};
