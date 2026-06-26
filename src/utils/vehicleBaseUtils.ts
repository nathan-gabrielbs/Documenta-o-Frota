import { Veiculo } from '../types';

export const POTENCIAL_COMBUSTIVEIS_EMPRESA_ID = 'empresa-potencial-combustiveis';

export const BASES_POTENCIAL_COMBUSTIVEIS = [
  'ARAUCÁRIA',
  'ARAUCÁRIA TRANSF.',
  'BETIM',
  'CHAPECÓ',
  'ESTEIO',
  'ITAJAÍ',
  'RIBEIRÃO PRETO',
  'SARANDI',
] as const;

export type BasePotencialCombustiveis = typeof BASES_POTENCIAL_COMBUSTIVEIS[number];

export function isPotencialCombustiveisVehicle(vehicle?: Pick<Veiculo, 'empresaId'> | null): boolean {
  return vehicle?.empresaId === POTENCIAL_COMBUSTIVEIS_EMPRESA_ID;
}

export function getVehicleBaseLabel(vehicle?: Pick<Veiculo, 'empresaId' | 'baseOperacional'> | null): string {
  if (!vehicle || !isPotencialCombustiveisVehicle(vehicle)) return '';
  return vehicle.baseOperacional || 'Base não definida';
}
