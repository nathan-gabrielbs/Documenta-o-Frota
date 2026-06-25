/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Usuario, Veiculo, Documento, AuditoriaLog, Empresa, StatusDocumento, TipoDocumento } from '../types';

export const PREDEFINED_COMPANIES: Empresa[] = [];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const COLLECTIONS = ['usuarios', 'empresas', 'veiculos', 'documentos', 'auditoria'] as const;
type CollectionName = typeof COLLECTIONS[number];

type CacheState = {
  usuarios: Usuario[];
  empresas: Empresa[];
  veiculos: Veiculo[];
  documentos: Documento[];
  auditoria: AuditoriaLog[];
};

const cache: CacheState = {
  usuarios: [],
  empresas: [],
  veiculos: [],
  documentos: [],
  auditoria: []
};

let isSyncing = false;
let lastSyncError: string | null = null;

function emitUpdate(type?: CollectionName) {
  window.dispatchEvent(new CustomEvent('mockdb-update', { detail: type ? { type } : undefined }));
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Falha na API Neon (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined) as unknown as T;
  const result: Record<string, unknown> = {};
  Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined) result[key] = cleanUndefined(value);
  });
  return result as T;
}

export function formatarDataBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  const [year, month, day] = clean.split('T')[0].split('-');
  return year && month && day ? `${day}/${month}/${year}` : clean;
}

export function calcularStatusDocumento(aplicavel: boolean, dataVencimentoStr: string): StatusDocumento {
  if (!aplicavel) return 'Não aplicável';
  if (!dataVencimentoStr?.trim()) return 'Vencido';

  const refDate = new Date();
  const expDate = new Date(dataVencimentoStr);
  if (Number.isNaN(expDate.getTime())) return 'Vencido';

  refDate.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Vencido';
  if (diffDays <= 30) return 'Crítico';
  if (diffDays <= 60) return 'Atenção';
  return 'Válido';
}

export function isDocumentApplicable(tipoUnidade: string, tipoDocumento: string): boolean {
  const tDoc = tipoDocumento.toUpperCase().trim();
  const tUnit = tipoUnidade ? tipoUnidade.trim() : '';
  const isMangote = tDoc === 'LAUDO MANGOTE' || tDoc === 'LAUDO DE MANGOTE';

  if (tUnit === 'Cavalo') return tDoc === 'CIV' || tDoc === 'TACÓGRAFO' || tDoc === 'LAUDO QUINTA RODA';
  if (tUnit === 'Carreta') return tDoc === 'CIV' || tDoc === 'CIPP' || tDoc === 'INMETRO' || tDoc === 'LAUDO DE BOTTOM' || isMangote;
  if (tUnit === 'Porta Container') return tDoc === 'CIV';
  return tDoc !== 'LAUDO QUINTA RODA';
}

export function isLocalOnly(): boolean {
  return false;
}

export function toggleLocalMode(_enabled: boolean) {
  console.warn('Modo local desativado: o projeto agora usa exclusivamente o banco Neon via API.');
  window.dispatchEvent(new CustomEvent('mockdb-mode-change'));
}

class NeonDB {
  constructor() {
    void this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const data = await apiFetch<CacheState>('/api/data');
      cache.usuarios = data.usuarios || [];
      cache.empresas = data.empresas || [];
      cache.veiculos = data.veiculos || [];
      cache.documentos = data.documentos || [];
      cache.auditoria = data.auditoria || [];
      lastSyncError = null;
      emitUpdate();
    } catch (error) {
      lastSyncError = error instanceof Error ? error.message : String(error);
      console.error('Erro ao sincronizar com Neon:', lastSyncError);
    } finally {
      isSyncing = false;
    }
  }

  getLastSyncError(): string | null {
    return lastSyncError;
  }

  private async replaceCollection<T extends { id: string }>(collection: CollectionName, rows: T[]): Promise<void> {
    cache[collection] = rows as never;
    emitUpdate(collection);
    await apiFetch(`/api/${collection}`, {
      method: 'PUT',
      body: JSON.stringify({ records: rows.map(cleanUndefined) })
    });
    await this.refreshAll();
  }

  getUsers(): Usuario[] { return cache.usuarios; }
  saveUsers(users: Usuario[]): Promise<void> { return this.replaceCollection('usuarios', users); }

  getCompanies(): Empresa[] { return cache.empresas; }
  saveCompanies(empresas: Empresa[]): Promise<void> { return this.replaceCollection('empresas', empresas); }

  getVehicles(): Veiculo[] { return cache.veiculos; }
  saveVehicles(vehs: Veiculo[]): Promise<void> { return this.replaceCollection('veiculos', vehs); }

  getDocuments(): Documento[] {
    const docTypes: TipoDocumento[] = ['CIV', 'CIPP', 'INMETRO', 'TACÓGRAFO', 'LAUDO QUINTA RODA', 'LAUDO DE BOTTOM', 'LAUDO MANGOTE'];
    const existing = new Map(cache.documentos.map(d => [`${d.veiculoId}-${d.tipoDocumento}`, d]));
    const nowISO = new Date().toISOString();
    const generated: Documento[] = [];

    cache.veiculos.forEach(vehicle => {
      docTypes.forEach(tipoDocumento => {
        const stored = existing.get(`${vehicle.id}-${tipoDocumento}`);
        const aplicavel = isDocumentApplicable(vehicle.tipoUnidade, tipoDocumento);
        generated.push(stored ? {
          ...stored,
          placa: vehicle.placa,
          empresaId: vehicle.empresaId,
          aplicavel,
          statusDocumento: calcularStatusDocumento(aplicavel, stored.dataVencimento)
        } : {
          id: `d-auto-${vehicle.id}-${tipoDocumento}`,
          veiculoId: vehicle.id,
          placa: vehicle.placa,
          empresaId: vehicle.empresaId,
          tipoDocumento,
          aplicavel,
          numeroDocumento: '',
          dataEmissao: '',
          dataVencimento: '',
          statusDocumento: aplicavel ? 'Vencido' : 'Não aplicável',
          criadoPor: 'Sistema',
          atualizadoPor: 'Sistema',
          dataCadastro: nowISO,
          dataAtualizacao: nowISO
        });
      });
    });

    return generated;
  }

  async saveDocuments(docs: Documento[]): Promise<void> {
    const normalized = docs.map(d => ({ ...d, statusDocumento: calcularStatusDocumento(d.aplicavel, d.dataVencimento) }));
    await this.replaceCollection('documentos', normalized);
  }

  async clearAllDocumentsAndExpirations(): Promise<void> {
    const blankDocs = this.getDocuments().map(d => ({
      ...d,
      numeroDocumento: '',
      dataEmissao: '',
      dataVencimento: '',
      arquivoAnexo: undefined,
      arquivoAnexoConteudo: undefined,
      observacoes: '',
      statusDocumento: d.aplicavel ? 'Vencido' : 'Não aplicável' as StatusDocumento,
      dataAtualizacao: new Date().toISOString(),
      atualizadoPor: 'Sistema'
    }));
    await this.saveDocuments(blankDocs);
  }

  async applyCSVExpirationsToAllDocuments(): Promise<void> {
    throw new Error('Importação/sincronização por CSV foi desativada. Cadastre ou importe vencimentos diretamente no Neon.');
  }

  getAudits(): AuditoriaLog[] {
    return [...cache.auditoria].sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  }

  saveAudits(auds: AuditoriaLog[]): Promise<void> { return this.replaceCollection('auditoria', auds); }

  async resetDB(): Promise<void> {
    await Promise.all(COLLECTIONS.map(collection => this.replaceCollection(collection, [])));
  }

  async logAudit(
    usuario: Usuario,
    veiculo: Veiculo,
    tipoAcao: AuditoriaLog['tipoAcao'],
    campoAlterado: string,
    valorAnterior: string,
    valorNovo: string,
    observacao?: string,
    documentoId?: string,
    tipoDocumento?: TipoDocumento
  ): Promise<void> {
    const newLog: AuditoriaLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      empresaId: veiculo.empresaId,
      veiculoId: veiculo.id,
      placa: veiculo.placa,
      documentoId,
      tipoDocumento,
      tipoAcao,
      campoAlterado,
      valorAnterior,
      valorNovo,
      observacao,
      dataHora: new Date().toISOString()
    };
    await this.saveAudits([newLog, ...cache.auditoria]);
  }
}

export const dbInLocalStorage = new NeonDB();
