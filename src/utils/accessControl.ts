import { Usuario } from '../types';

export function getAuthorizedEmpresaIds(user?: Pick<Usuario, 'empresaId' | 'empresaIds'> | null): string[] {
  if (!user) return [];
  const ids = user.empresaIds?.length ? user.empresaIds : user.empresaId ? [user.empresaId] : [];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function hasGeneralCompanyAccess(user?: Pick<Usuario, 'empresaId' | 'empresaIds'> | null): boolean {
  return getAuthorizedEmpresaIds(user).length === 0;
}

export function canAccessEmpresa(user: Pick<Usuario, 'empresaId' | 'empresaIds'>, empresaId?: string | null): boolean {
  if (!empresaId) return false;
  const authorized = getAuthorizedEmpresaIds(user);
  return authorized.length === 0 || authorized.includes(empresaId);
}

export function getEffectiveEmpresaFilter(
  user: Pick<Usuario, 'empresaId' | 'empresaIds'>,
  selectedEmpresaGlobal: string,
  localCompanyFilter = ''
): string {
  const requested = selectedEmpresaGlobal || localCompanyFilter;
  if (!requested) return '';
  return canAccessEmpresa(user, requested) ? requested : '__unauthorized__';
}
