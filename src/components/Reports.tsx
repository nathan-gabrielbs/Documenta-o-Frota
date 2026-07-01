/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, CheckCircle2, AlertTriangle, XCircle, FileText, 
  Search, ClipboardList, RefreshCw, User, Download, Calendar, 
  Layers, Cpu, BookOpen, AlertOctagon, HelpCircle
} from 'lucide-react';
import { Veiculo, Documento, Empresa, Usuario, AuditoriaLog, TipoUnidade } from '../types';
import { dbInLocalStorage, PREDEFINED_COMPANIES } from '../utils/mockdb';
import { canAccessEmpresa, getEffectiveEmpresaFilter } from '../utils/accessControl';
import { EMPRESAS_PADRAO, obterNomeEmpresa } from '../utils/empresaUtils';
import { getVehicleBaseLabel } from '../utils/vehicleBaseUtils';

interface ReportsProps {
  currentUser: Usuario;
  selectedEmpresaGlobal: string;
}

export default function Reports({ currentUser, selectedEmpresaGlobal }: ReportsProps) {
  
  // Trigger state to capture updates from Neon
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener('mockdb-update', handleUpdate);
    return () => window.removeEventListener('mockdb-update', handleUpdate);
  }, []);

  // Local Database snapshot
  const vehicles = useMemo(() => dbInLocalStorage.getVehicles(), [updateTrigger]);
  const documents = useMemo(() => dbInLocalStorage.getDocuments(), [updateTrigger]);
  const audits = useMemo(() => dbInLocalStorage.getAudits(), [updateTrigger]);
  const companies = PREDEFINED_COMPANIES.length > 0 ? PREDEFINED_COMPANIES : EMPRESAS_PADRAO;

  // Filter builders configurations
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDocType, setFilterDocType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlaca, setFilterPlaca] = useState('');
  const [filterApplicableOnly, setFilterApplicableOnly] = useState<'all' | 'applicable' | 'non-applicable'>('all');
  const [filterUserModified, setFilterUserModified] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Get distinct list of users who modified documents for filter options
  const modifyingUsersList = useMemo(() => {
    const list = new Set(documents.map(d => d.atualizadoPor).filter(Boolean));
    return Array.from(list).sort();
  }, [documents]);

  // Dynamic Query Filter Execution
  const reportResultSet = useMemo(() => {
    return documents.filter(doc => {
      // Find corresponding vehicle
      const veh = vehicles.find(v => v.id === doc.veiculoId);
      if (!veh || veh.status !== 'ativo') return false;

      if (!canAccessEmpresa(currentUser, doc.empresaId)) return false;
      // Filter: Company (respect global selected header if applicable)
      const targetCompany = getEffectiveEmpresaFilter(currentUser, selectedEmpresaGlobal, filterEmpresa);
      if (targetCompany && doc.empresaId !== targetCompany) return false;

      // Filter: Unit type
      if (filterType && veh.tipoUnidade !== filterType) return false;

      // Filter: Doc type
      if (filterDocType && doc.tipoDocumento !== filterDocType) return false;

      // Filter: Doc status
      if (filterStatus && doc.statusDocumento !== filterStatus) return false;

      // Filter: Plate query
      if (filterPlaca && !doc.placa.toLowerCase().includes(filterPlaca.toLowerCase())) return false;

      // Filter: Applicability
      if (filterApplicableOnly === 'applicable' && !doc.aplicavel) return false;
      if (filterApplicableOnly === 'non-applicable' && doc.aplicavel) return false;

      // Filter: User who last modified
      if (filterUserModified && doc.atualizadoPor !== filterUserModified) return false;

      // Filter: Expiration range
      if (doc.dataVencimento) {
        const docTime = new Date(doc.dataVencimento).getTime();
        if (filterStartDate) {
          const startTime = new Date(filterStartDate).getTime();
          if (docTime < startTime) return false;
        }
        if (filterEndDate) {
          const endTime = new Date(filterEndDate).getTime();
          if (docTime > endTime) return false;
        }
      } else {
        // If no expiry date is saved but range filters exist, reject it
        if (filterStartDate || filterEndDate) return false;
      }

      return true;
    });
  }, [documents, vehicles, currentUser, filterEmpresa, filterType, filterDocType, filterStatus, filterPlaca, filterApplicableOnly, filterUserModified, filterStartDate, filterEndDate, selectedEmpresaGlobal]);

  // Aggregate stats based on our active report query output
  // Regra: documentos isentos / não aplicáveis NÃO entram no cálculo de estatísticas e conformidade.
  const reportStats = useMemo(() => {
    const documentosAplicaveis = reportResultSet.filter(d => d.aplicavel === true);
    const documentosIsentos = reportResultSet.filter(d => d.aplicavel === false);

    let total = documentosAplicaveis.length;
    let validos = 0;
    let atencao = 0;
    let criticos = 0;
    let vencidos = 0;
    let naoAplicaveis = documentosIsentos.length;

    documentosAplicaveis.forEach(d => {
      if (d.statusDocumento === 'Válido') {
        validos++;
      } else if (d.statusDocumento === 'Atenção') {
        atencao++;
      } else if (d.statusDocumento === 'Crítico') {
        criticos++;
      } else if (d.statusDocumento === 'Vencido') {
        vencidos++;
      }
    });

    const totalAplicaveis = total;
    const compliantCount = validos + atencao;
    const generalCompliance = totalAplicaveis > 0 ? Math.round((compliantCount / totalAplicaveis) * 100) : 100;

    return {
      total,
      totalBruto: reportResultSet.length,
      validos,
      atencao,
      criticos,
      vencidos,
      naoAplicaveis,
      totalAplicaveis,
      generalCompliance
    };
  }, [reportResultSet]);

  // Segmented compliance rate calculations (For Corporate Breakdown)
  const statsByEnterprise = useMemo(() => {
    return companies.filter(comp => canAccessEmpresa(currentUser, comp.id)).map(comp => {
      const compVehicleIds = new Set(vehicles.filter(v => v.empresaId === comp.id && v.status === 'ativo').map(v => v.id));
      const compDocs = documents.filter(d => compVehicleIds.has(d.veiculoId));
      const appDocs = compDocs.filter(d => d.aplicavel);
      const okDocs = appDocs.filter(d => d.statusDocumento === 'Válido' || d.statusDocumento === 'Atenção');
      const compliance = appDocs.length > 0 ? Math.round((okDocs.length / appDocs.length) * 100) : 100;

      return {
        id: comp.id,
        nome: obterNomeEmpresa(comp.id, companies),
        docTotal: compDocs.length,
        applicableTotal: appDocs.length,
        compliance
      };
    });
  }, [vehicles, documents, companies]);

  // Segmented compliance rate calculations by Unit Type
  const statsByUnitType = useMemo(() => {
    const types: TipoUnidade[] = ['Cavalo', 'Carreta', 'Porta Container', 'Truck', 'Toco', 'Bitruck', 'Baú', 'Outro'];
    return types.map(t => {
      const typeVehs = vehicles.filter(v => v.status === 'ativo' && v.tipoUnidade === t);
      const vehIds = new Set(typeVehs.map(v => v.id));
      const typeDocs = documents.filter(d => vehIds.has(d.veiculoId));
      const appDocs = typeDocs.filter(d => d.aplicavel);
      const okDocs = appDocs.filter(d => d.statusDocumento === 'Válido' || d.statusDocumento === 'Atenção');
      const compliance = appDocs.length > 0 ? Math.round((okDocs.length / appDocs.length) * 100) : 100;

      return {
        tipo: t,
        vehiclesCount: typeVehs.length,
        compliance
      };
    }).filter(item => item.vehiclesCount > 0);
  }, [vehicles, documents]);

  // Identify specific license plates with extreme non-compliance (missing documents or expired ones)
  const problematicPlates = useMemo(() => {
    const list: { plate: string; company: string; missingCount: number; expiredCount: number }[] = [];
    
    vehicles.filter(veh => veh.status === 'ativo').forEach(veh => {
      const vehDocs = documents.filter(d => d.veiculoId === veh.id);
      const appDocs = vehDocs.filter(d => d.aplicavel);
      
      const missingCount = appDocs.filter(d => !d.dataVencimento).length;
      const expiredCount = appDocs.filter(d => d.statusDocumento === 'Vencido').length;

      if (missingCount > 0 || expiredCount > 0) {
        list.push({
          plate: veh.placa,
          company: obterNomeEmpresa(veh.empresaId, companies),
          missingCount,
          expiredCount
        });
      }
    });

    return list.slice(0, 10);
  }, [vehicles, documents]);

  const activeAuditRenewals = useMemo(() => {
    return audits.filter(a => (a.tipoAcao === 'renovação' || a.tipoAcao === 'edição') && canAccessEmpresa(currentUser, a.empresaId));
  }, [audits, currentUser]);

  const exportableReportSet = useMemo(() => {
    // Regra de exportação: não exportar documentos isentos / não aplicáveis.
    return reportResultSet.filter(doc => doc.aplicavel === true);
  }, [reportResultSet]);

  const escapeCsvValue = (value: unknown) => {
    if (value === null || value === undefined) return '';

    const normalizedValue = String(value).replace(/\r?\n|\r/g, ' ').trim();

    if (
      normalizedValue.includes(';') ||
      normalizedValue.includes('"') ||
      normalizedValue.includes('\n')
    ) {
      return `"${normalizedValue.replace(/"/g, '""')}"`;
    }

    return normalizedValue;
  };

  const formatDateTimeBR = (value?: string) => {
    if (!value) return '';

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;

    return parsedDate.toLocaleString('pt-BR');
  };

  const formatDateForFileName = () => {
    return new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-');
  };

  const getAppliedFiltersDescription = () => {
    const filtros: string[] = [];

    const empresaSelecionada = selectedEmpresaGlobal || filterEmpresa;

    if (empresaSelecionada) {
      filtros.push(`Empresa: ${obterNomeEmpresa(empresaSelecionada, companies)}`);
    } else {
      filtros.push('Empresa: Todas');
    }

    filtros.push(filterType ? `Tipo de unidade: ${filterType}` : 'Tipo de unidade: Todos');
    filtros.push(filterDocType ? `Tipo de documento: ${filterDocType}` : 'Tipo de documento: Todos');
    filtros.push(filterStatus ? `Status: ${filterStatus}` : 'Status: Todos');

    if (filterPlaca) {
      filtros.push(`Placa contém: ${filterPlaca.toUpperCase()}`);
    }

    if (filterApplicableOnly === 'applicable') {
      filtros.push('Aplicabilidade: Somente aplicáveis');
    } else if (filterApplicableOnly === 'non-applicable') {
      filtros.push('Aplicabilidade: filtro selecionado como isentos, porém estes registros não são exportados');
    } else {
      filtros.push('Aplicabilidade: Todos, exceto isentos / não aplicáveis na exportação');
    }

    if (filterUserModified) {
      filtros.push(`Último usuário modificador: ${filterUserModified}`);
    }

    if (filterStartDate) {
      filtros.push(`Vencimento inicial: ${filterStartDate}`);
    }

    if (filterEndDate) {
      filtros.push(`Vencimento final: ${filterEndDate}`);
    }

    return filtros;
  };

  const handleExportReportCSV = () => {
    const generatedAt = new Date();

    const metadataRows = [
      ['Relatório', 'Conformidade documental da frota'],
      ['Gerado em', generatedAt.toLocaleString('pt-BR')],
      ['Usuário auditor', currentUser.nome],
      ['Perfil do usuário', currentUser.perfil],
      ['Total exportado', exportableReportSet.length],
      ['Total aplicável filtrado', reportStats.totalAplicaveis],
      ['Conformidade aplicável', `${reportStats.generalCompliance}%`],
      ['Válidos', reportStats.validos],
      ['Em atenção', reportStats.atencao],
      ['Críticos', reportStats.criticos],
      ['Vencidos', reportStats.vencidos],
      [],
      ['Filtros aplicados'],
      ...getAppliedFiltersDescription().map((item) => [item]),
      [],
      ['Dados exportados'],
    ];

    const header = [
      'Placa',
      'Empresa',
      'Tipo de unidade',
      'Modelo',
      'Ano',
      'RENAVAM',
      'Tipo documento',
      'Número documento',
      'Data emissão',
      'Data vencimento',
      'Status documento',
      'Último usuário modificador',
      'Data atualização',
      'Criado por',
      'Data cadastro',
      'Observações',
    ];

    const dataRows = exportableReportSet.map((doc) => {
      const veh = vehicles.find((vehicle) => vehicle.id === doc.veiculoId);

      return [
        doc.placa,
        obterNomeEmpresa(doc.empresaId, companies),
        veh?.tipoUnidade || '',
        veh?.modelo || '',
        veh?.ano || '',
        veh?.renavam || '',
        doc.tipoDocumento,
        doc.numeroDocumento || '',
        doc.dataEmissao || '',
        doc.dataVencimento || '',
        doc.statusDocumento || '',
        doc.atualizadoPor || '',
        formatDateTimeBR(doc.dataAtualizacao),
        doc.criadoPor || '',
        formatDateTimeBR(doc.dataCadastro),
        doc.observacoes || '',
      ];
    });

    const csvRows = [
      ...metadataRows,
      header,
      ...dataRows,
    ];

    const csvContent = csvRows
      .map((row) => row.map(escapeCsvValue).join(';'))
      .join('\r\n');

    // BOM ajuda o Excel no Windows a abrir acentos corretamente.
    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const fileName = `relatorio-auditoria-frota-${formatDateForFileName()}.csv`;

    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-7 pb-8">
      
      {/* Grupo Potencial corporate hero - sem bloco de logo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-blue-950/10 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 md:p-7 shadow-xl shadow-blue-950/10"
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-200 ring-1 ring-white/15">
                <BookOpen className="h-3.5 w-3.5" />
                Grupo Potencial
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200 ring-1 ring-emerald-300/20">
                Governança documental
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100 ring-1 ring-blue-300/20">
                Auditoria de frota
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Relatórios e Auditorias
            </h1>
            <p className="mt-2 max-w-3xl text-sm md:text-base text-blue-100/85 font-medium leading-relaxed">
              Consulte cruzamentos da frota, acompanhe conformidade documental e exporte trilhas de auditoria com segurança, rastreabilidade e padrão corporativo.
            </p>
          </div>

          <div className="w-full xl:w-auto xl:min-w-[360px] rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur shadow-lg shadow-slate-950/10">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-100/70">
                  Aplicáveis
                </span>
                <strong className="mt-1 block text-2xl font-black text-white">
                  {reportStats.totalAplicaveis}
                </strong>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-100/70">
                  Conformidade
                </span>
                <strong className="mt-1 block text-2xl font-black text-amber-200">
                  {reportStats.generalCompliance}%
                </strong>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-100/70">
                  Auditorias
                </span>
                <strong className="mt-1 block text-2xl font-black text-white">
                  {activeAuditRenewals.length}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportReportCSV}
              disabled={exportableReportSet.length === 0}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
              title="Exportar relatório CSV conforme filtros aplicados, sem documentos não aplicáveis"
            >
              <Download className="h-4 w-4" />
              Exportar CSV filtrado
            </button>
          </div>
        </div>
      </motion.div>

      {/* Indicadores executivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-100/80 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Documentos filtrados
              </span>
              <strong className="mt-2 block text-3xl font-black text-slate-950">
                {reportStats.total}
              </strong>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Registros aplicáveis na consulta atual
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 ring-1 ring-blue-100">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-emerald-100/80 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Taxa de conformidade
              </span>
              <strong className="mt-2 block text-3xl font-black text-slate-950">
                {reportStats.generalCompliance}%
              </strong>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Válidos + atenção sobre aplicáveis
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-rose-100/80 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Risco documental
              </span>
              <strong className="mt-2 block text-3xl font-black text-slate-950">
                {reportStats.criticos + reportStats.vencidos}
              </strong>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Críticos e vencidos no filtro
              </p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-700 ring-1 ring-rose-100">
              <AlertOctagon className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-100/80 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Trilhas registradas
              </span>
              <strong className="mt-2 block text-3xl font-black text-slate-950">
                {activeAuditRenewals.length}
              </strong>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Renovações e edições auditáveis
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 ring-1 ring-amber-100">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Structured multi-filter query block */}
      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-lg shadow-slate-950/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-700" />
              Gerador de Consulta Avançada de Frota
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Use os filtros abaixo para montar uma visão auditável antes da exportação.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700 ring-1 ring-blue-100">
            <Cpu className="h-3.5 w-3.5" />
            {exportableReportSet.length} registros para exportar
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
          {/* Company */}
          {!selectedEmpresaGlobal && (
            <div>
              <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Empresa da Frota</span>
              <select
                id="q-company"
                value={filterEmpresa}
                onChange={(e) => setFilterEmpresa(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
              >
                <option value="">Todas</option>
                {companies.filter(c => canAccessEmpresa(currentUser, c.id)).map(c => <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companies)}</option>)}
              </select>
            </div>
          )}

          {/* Unit Type */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Tipo de Unidade</span>
            <select
              id="q-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
            >
              <option value="">Todos</option>
              <option value="Cavalo">Cavalo</option>
              <option value="Carreta">Carreta</option>
              <option value="Porta Container">Porta Container</option>
              <option value="Truck">Truck</option>
              <option value="Toco">Toco</option>
              <option value="Bitruck">Bitruck</option>
              <option value="Baú">Baú</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Document Type */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Tipo de Documento</span>
            <select
              id="q-doc-type"
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
            >
              <option value="">Todos</option>
              <option value="INMETRO">INMETRO</option>
              <option value="TACÓGRAFO">TACÓGRAFO</option>
              <option value="CIV">CIV</option>
              <option value="CIPP">CIPP</option>
              <option value="LAUDO QUINTA RODA">LAUDO QUINTA RODA</option>
              <option value="LAUDO DE BOTTOM">LAUDO DE BOTTOM</option>
              <option value="LAUDO MANGOTE">LAUDO MANGOTE</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Status Documento</span>
            <select
              id="q-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
            >
              <option value="">Todos</option>
              <option value="Válido">Válido</option>
              <option value="Atenção">Atenção</option>
              <option value="Crítico">Crítico</option>
              <option value="Vencido">Vencido</option>
              <option value="Não aplicável">Não aplicável</option>
            </select>
          </div>

          {/* Plate Search */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Placa Específica</span>
            <input
              id="q-plate"
              type="text"
              placeholder="Ex: ABC1D23"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold font-mono text-slate-800 shadow-sm outline-none transition-all focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
              value={filterPlaca}
              onChange={(e) => setFilterPlaca(e.target.value)}
            />
          </div>

          {/* Applicability selector */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Aplicabilidade</span>
            <select
              id="q-app"
              value={filterApplicableOnly}
              onChange={(e) => setFilterApplicableOnly(e.target.value as any)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
            >
              <option value="all">Documentos gerais (Todos)</option>
              <option value="applicable">Somente aplicáveis no veículo</option>
              <option value="non-applicable">Isentos (Não aplicáveis)</option>
            </select>
          </div>

          {/* User who generated last change */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Últmo usuário modificador</span>
            <select
              id="q-user"
              value={filterUserModified}
              onChange={(e) => setFilterUserModified(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
            >
              <option value="">Todos os usuários</option>
              {modifyingUsersList.map(usr => <option key={usr} value={usr}>{usr}</option>)}
            </select>
          </div>

          {/* Date Picker Start */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Vencimento inicial</span>
            <input
              id="q-start-date"
              type="date"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>

          {/* Date Picker End */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5 font-black tracking-[0.14em] uppercase">Vencimento final</span>
            <input
              id="q-end-date"
              type="date"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all cursor-pointer focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>

        </div>

        {/* Clear query shortcuts trigger */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => {
              setFilterEmpresa('');
              setFilterType('');
              setFilterDocType('');
              setFilterStatus('');
              setFilterPlaca('');
              setFilterApplicableOnly('all');
              setFilterUserModified('');
              setFilterStartDate('');
              setFilterEndDate('');
            }}
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-rose-700 transition-all hover:bg-rose-100 active:scale-[0.98] cursor-pointer"
          >
            Resetar Filtros
          </button>
        </div>
      </div>

      {/* AGGREGATED REPORT RESULTS SUMMARY SPACES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Col 1: General Results Aggregations of Query */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-lg shadow-slate-950/5">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 border-b border-slate-100 pb-3">
            Estatísticas do Filtro Emitido
          </h3>

          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center shadow-sm">
              <span className="text-[10px] text-slate-500 block font-black tracking-[0.16em] uppercase">ENCONTRADOS</span>
              <strong className="text-2xl text-slate-950 font-black">{reportStats.total}</strong>
              <span className="text-xs text-slate-400 block font-bold">documentos aplicáveis</span>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-center shadow-sm">
              <span className="text-[10px] text-blue-700 block font-black tracking-[0.16em] uppercase">CONFORMIDADE</span>
              <strong className="text-2xl text-blue-700 font-black">{reportStats.generalCompliance}%</strong>
              <span className="text-xs text-blue-400 block font-bold">taxa aplicável</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-50 rounded transition-colors">
              <span>Válidos</span>
              <strong className="text-emerald-600 font-bold">{reportStats.validos}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-50 rounded transition-colors">
              <span>Em Atenção</span>
              <strong className="text-amber-600 font-bold">{reportStats.atencao}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-50 rounded transition-colors">
              <span>Críticos</span>
              <strong className="text-rose-500 font-bold">{reportStats.criticos}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-50 rounded transition-colors">
              <span>Já Vencidos</span>
              <strong className="text-rose-600 font-extrabold">{reportStats.vencidos}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-50 rounded transition-colors">
            </div>
          </div>
        </div>

        {/* Col 2: Segmented compliance ratings (Company & Unit type summaries) */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-lg shadow-slate-950/5">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 border-b border-slate-100 pb-3">
            Conformidades Corporativas Gerais
          </h3>

          {/* Breakdown by Company */}
          <div className="space-y-2.5">
            <span className="text-[11px] uppercase font-black tracking-[0.16em] text-slate-400 block">
              1. Por Empresa da Frota:
            </span>

            {statsByEnterprise.map(comp => (
              <div key={comp.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-colors">
                <span className="text-slate-700 truncate max-w-[170px]">{comp.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">{comp.docTotal} docs</span>
                  <span className={`font-bold ${
                    comp.compliance >= 90 ? 'text-emerald-600' :
                    comp.compliance >= 70 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {comp.compliance}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown by Unit type */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <span className="text-[11px] uppercase font-black tracking-[0.16em] text-slate-400 block">
              2. Por Tipo de Unidade:
            </span>

            {statsByUnitType.map(item => (
              <div key={item.tipo} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-colors">
                <span className="text-slate-700">{item.tipo}</span>
                <span className="font-bold text-slate-900">{item.compliance}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Priority alerts - plates with missing properties */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-lg shadow-slate-950/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">
            Placas com Pendências Impeditivas
          </h3>

          {problematicPlates.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic font-medium">
              Nenhuma placa com documentos exigíveis em falta ou atualmente vencidos.
            </div>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
              {problematicPlates.map(item => (
                <div key={item.plate} className="text-xs p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm hover:border-blue-100 hover:bg-white transition-all">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 shadow-xs px-1.5 py-0.5 rounded text-sm">
                      {item.plate}
                    </span>
                    <span className="text-xs block text-slate-500 font-bold mt-1 uppercase tracking-tight">{item.company}</span>
                  </div>

                  <div className="text-right space-y-0.5 text-xs font-bold">
                    {item.expiredCount > 0 && (
                      <span className="block text-rose-600 font-bold">{item.expiredCount} vencidos</span>
                    )}
                    {item.missingCount > 0 && (
                      <span className="block text-amber-600 font-semibold">{item.missingCount} sem dados/faltantes</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* MASTER SYSTEM AUDIT LOGS TRAIL SECTION */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-950/5">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-blue-100/70 blur-3xl" />

        <h3 className="relative text-xs font-black uppercase tracking-[0.18em] text-slate-900 border-b border-slate-100 pb-4 mb-4 flex items-center gap-2">
          <ClipboardList className="h-4.5 w-4.5 text-blue-700" />
          Relação Histórica de Documentos Renovados / Alterações Gerais
        </h3>

        {activeAuditRenewals.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs italic font-semibold">
            Nenhuma ação de alteração de datas gravada no período.
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
            {activeAuditRenewals.map((log) => {
              const logDateStr = new Date(log.dataHora).toLocaleDateString('pt-BR');
              const logTimeStr = new Date(log.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={log.id} className="text-xs p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between gap-6 shadow-sm hover:bg-white hover:border-blue-100 hover:shadow-md transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono bg-white border border-slate-200 text-slate-900 px-2.5 py-1 rounded-lg font-black text-sm shadow-sm">
                        {log.placa}
                      </span>
                      {getVehicleBaseLabel(vehicles.find(v => v.id === log.veiculoId || v.placa === log.placa)) && (
                        <span className="text-[11px] bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5 font-bold">
                          {getVehicleBaseLabel(vehicles.find(v => v.id === log.veiculoId || v.placa === log.placa))}
                        </span>
                      )}
                      <span className="text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {obterNomeEmpresa(log.empresaId, companies)}
                      </span>
                      <span className="font-bold text-slate-800">{log.campoAlterado}</span>
                    </div>

                    <p className="text-sm text-slate-600 font-semibold">
                      Modificação: De <span className="text-slate-400 line-through font-normal">{log.valorAnterior || 'Em branco'}</span> para <strong className="text-blue-600 font-extrabold">{log.valorNovo}</strong>
                    </p>

                    {log.observacao && (
                      <p className="text-sm text-slate-500 italic pl-3 border-l-4 border-amber-300 mt-2 font-semibold">
                        Justificativa inserida: "{log.observacao}"
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 md:text-right shrink-0 font-medium">
                    <div className="flex items-center md:justify-end gap-1 font-bold text-slate-700">
                      <User className="h-3 w-3 inline text-slate-400" />
                      {log.usuarioNome}
                    </div>
                    <span className="block mt-0.5 font-mono text-xs text-slate-400">
                      Modificado em {logDateStr} às {logTimeStr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
