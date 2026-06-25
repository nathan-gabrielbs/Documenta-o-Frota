import { Empresa } from '../types';

export const NOMES_EMPRESAS_PADRAO: Record<string, string> = {
  'empresa-bwt': 'BWT',
  'empresa-potencial-combustiveis': 'POTENCIAL COMBUSTÍVEIS',
  'empresa-potencial-agro': 'POTENCIAL AGRO',
  'empresa-bwi': 'BWI',
  'empresa-jeta': 'JETA',
};

export const EMPRESAS_PADRAO: Empresa[] = Object.entries(NOMES_EMPRESAS_PADRAO).map(
  ([id, nomeEmpresa]) => ({
    id,
    nomeEmpresa,
    status: 'ativo',
    dataCadastro: '',
  })
);

export function formatarNomeEmpresaId(empresaId?: string | null): string {
  if (!empresaId) return '';

  if (NOMES_EMPRESAS_PADRAO[empresaId]) {
    return NOMES_EMPRESAS_PADRAO[empresaId];
  }

  return empresaId
    .replace(/^empresa-/, '')
    .replace(/-/g, ' ')
    .toUpperCase();
}

export function obterNomeEmpresa(
  empresaId?: string | null,
  empresas?: Empresa[]
): string {
  if (!empresaId) return '';

  const empresa = empresas?.find((item) => item.id === empresaId);

  return (
    empresa?.nomeEmpresa ||
    (empresa as any)?.nome ||
    NOMES_EMPRESAS_PADRAO[empresaId] ||
    formatarNomeEmpresaId(empresaId)
  );
}

export function obterNomeEmpresaDoRegistro(
  registro: {
    empresaId?: string | null;
    empresaNome?: string | null;
  },
  empresas?: Empresa[]
): string {
  if (registro.empresaNome && !registro.empresaNome.startsWith('empresa-')) {
    return registro.empresaNome;
  }

  return obterNomeEmpresa(registro.empresaId, empresas);
}
