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
  const companies = PREDEFINED_COMPANIES;

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
      if (!veh) return false;

      // Filter: Company (respect global selected header if applicable)
      const targetCompany = selectedEmpresaGlobal || filterEmpresa;
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
  }, [documents, vehicles, filterEmpresa, filterType, filterDocType, filterStatus, filterPlaca, filterApplicableOnly, filterUserModified, filterStartDate, filterEndDate, selectedEmpresaGlobal]);

  // Aggregate stats based on our active report query output
  const reportStats = useMemo(() => {
    let total = reportResultSet.length;
    let validos = 0;
    let atencao = 0;
    let criticos = 0;
    let vencidos = 0;
    let naoAplicaveis = 0;

    reportResultSet.forEach(d => {
      if (!d.aplicavel) {
        naoAplicaveis++;
      } else if (d.statusDocumento === 'Válido') {
        validos++;
      } else if (d.statusDocumento === 'Atenção') {
        atencao++;
      } else if (d.statusDocumento === 'Crítico') {
        criticos++;
      } else if (d.statusDocumento === 'Vencido') {
        vencidos++;
      }
    });

    const totalAplicaveis = total - naoAplicaveis;
    const compliantCount = validos + atencao;
    const generalCompliance = totalAplicaveis > 0 ? Math.round((compliantCount / totalAplicaveis) * 100) : 100;

    return {
      total,
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
    return companies.map(comp => {
      const compDocs = documents.filter(d => d.empresaId === comp.id);
      const appDocs = compDocs.filter(d => d.aplicavel);
      const okDocs = appDocs.filter(d => d.statusDocumento === 'Válido' || d.statusDocumento === 'Atenção');
      const compliance = appDocs.length > 0 ? Math.round((okDocs.length / appDocs.length) * 100) : 100;

      return {
        id: comp.id,
        nome: comp.nomeEmpresa,
        docTotal: compDocs.length,
        applicableTotal: appDocs.length,
        compliance
      };
    });
  }, [documents, companies]);

  // Segmented compliance rate calculations by Unit Type
  const statsByUnitType = useMemo(() => {
    const types: TipoUnidade[] = ['Cavalo', 'Carreta', 'Porta Container', 'Truck', 'Toco', 'Bitruck', 'Outro'];
    return types.map(t => {
      const typeVehs = vehicles.filter(v => v.tipoUnidade === t);
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
    
    vehicles.forEach(veh => {
      const vehDocs = documents.filter(d => d.veiculoId === veh.id);
      const appDocs = vehDocs.filter(d => d.aplicavel);
      
      const missingCount = appDocs.filter(d => !d.dataVencimento).length;
      const expiredCount = appDocs.filter(d => d.statusDocumento === 'Vencido').length;

      if (missingCount > 0 || expiredCount > 0) {
        list.push({
          plate: veh.placa,
          company: veh.empresaId,
          missingCount,
          expiredCount
        });
      }
    });

    return list.slice(0, 10);
  }, [vehicles, documents]);

  const activeAuditRenewals = useMemo(() => {
    return audits.filter(a => a.tipoAcao === 'renovação' || a.tipoAcao === 'edição');
  }, [audits]);

  return (
    <div className="space-y-6">
      
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <ClipboardList className="text-blue-600 h-6 w-6" />
            Emissor de Relatórios e Auditorias
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Filtre cruzamentos detalhados, confira taxas de conformidade e as trilhas de auditoria das renovações.
          </p>
        </div>

        <div className="flex items-center gap-2 py-2.5 px-4 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs border border-slate-200">
          <Download className="h-4 w-4" />
          Exportação CSV desativada
        </div>
      </div>

      {/* Structured multi-filter query block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-blue-600" />
          Gerador de Consulta Avançada de Frota
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Company */}
          {!selectedEmpresaGlobal && (
            <div>
              <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Empresa da Frota</span>
              <select
                id="q-company"
                value={filterEmpresa}
                onChange={(e) => setFilterEmpresa(e.target.value)}
                className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
              >
                <option value="">Todas</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.nomeEmpresa}</option>)}
              </select>
            </div>
          )}

          {/* Unit Type */}
          <div>
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Tipo de Unidade</span>
            <select
              id="q-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="Cavalo">Cavalo</option>
              <option value="Carreta">Carreta</option>
              <option value="Porta Container">Porta Container</option>
              <option value="Truck">Truck</option>
              <option value="Toco">Toco</option>
              <option value="Bitruck">Bitruck</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Document Type */}
          <div>
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Tipo de Documento</span>
            <select
              id="q-doc-type"
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
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
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Status Documento</span>
            <select
              id="q-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
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
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Placa Específica</span>
            <input
              id="q-plate"
              type="text"
              placeholder="Ex: ABC1D23"
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-medium font-mono"
              value={filterPlaca}
              onChange={(e) => setFilterPlaca(e.target.value)}
            />
          </div>

          {/* Applicability selector */}
          <div>
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Aplicabilidade</span>
            <select
              id="q-app"
              value={filterApplicableOnly}
              onChange={(e) => setFilterApplicableOnly(e.target.value as any)}
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
            >
              <option value="all">Documentos gerais (Todos)</option>
              <option value="applicable">Somente aplicáveis no veículo</option>
              <option value="non-applicable">Isentos (Não aplicáveis)</option>
            </select>
          </div>

          {/* User who generated last change */}
          <div>
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Últmo usuário modificador</span>
            <select
              id="q-user"
              value={filterUserModified}
              onChange={(e) => setFilterUserModified(e.target.value)}
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
            >
              <option value="">Todos os usuários</option>
              {modifyingUsersList.map(usr => <option key={usr} value={usr}>{usr}</option>)}
            </select>
          </div>

          {/* Date Picker Start */}
          <div>
            <span className="block text-slate-500 mb-1 font-bold tracking-wide uppercase text-[10px]">Vencimento inicial</span>
            <input
              id="q-start-date"
              type="date"
              className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-855 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-9 text-xs font-semibold cursor-pointer"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
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
            className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 transition-colors cursor-pointer"
          >
            Resetar Filtros
          </button>
        </div>
      </div>

      {/* AGGREGATED REPORT RESULTS SUMMARY SPACES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Col 1: General Results Aggregations of Query */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-3">
            Estatísticas do Filtro Emitido
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center shadow-xs">
              <span className="text-[10px] text-slate-500 block font-bold tracking-tight uppercase">ENCONTRADOS</span>
              <strong className="text-xl text-slate-900 font-extrabold">{reportStats.total}</strong>
              <span className="text-[9px] text-slate-400 block font-bold">documentos</span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-250 rounded-xl text-center shadow-xs">
              <span className="text-[10px] text-blue-600 block font-bold tracking-tight uppercase">CONFORMIDADE</span>
              <strong className="text-xl text-blue-600 font-extrabold">{reportStats.generalCompliance}%</strong>
              <span className="text-[9px] text-blue-400 block font-bold">taxa aplicável</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-55 rounded transition-colors">
              <span>Válidos</span>
              <strong className="text-emerald-600 font-bold">{reportStats.validos}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-55 rounded transition-colors">
              <span>Em Atenção</span>
              <strong className="text-amber-600 font-bold">{reportStats.atencao}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-55 rounded transition-colors">
              <span>Críticos</span>
              <strong className="text-rose-500 font-bold">{reportStats.criticos}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-55 rounded transition-colors">
              <span>Já Vencidos</span>
              <strong className="text-rose-600 font-extrabold">{reportStats.vencidos}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 font-semibold p-1.5 hover:bg-slate-55 rounded transition-colors">
              <span>Isentos de conformidade</span>
              <strong className="text-slate-500 font-bold">{reportStats.naoAplicaveis}</strong>
            </div>
          </div>
        </div>

        {/* Col 2: Segmented compliance ratings (Company & Unit type summaries) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-3">
            Conformidades Corporativas Gerais
          </h3>

          {/* Breakdown by Company */}
          <div className="space-y-2.5">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
              1. Por Empresa da Frota:
            </span>

            {statsByEnterprise.map(comp => (
              <div key={comp.id} className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700 truncate max-w-[170px]">{comp.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">{comp.docTotal} docs</span>
                  <span className={`font-bold ${
                    comp.compliance >= 90 ? 'text-emerald-600' :
                    comp.compliance >= 70 ? 'text-amber-550' : 'text-rose-600'
                  }`}>
                    {comp.compliance}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown by Unit type */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
              2. Por Tipo de Unidade:
            </span>

            {statsByUnitType.map(item => (
              <div key={item.tipo} className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700">{item.tipo}</span>
                <span className="font-bold text-slate-900">{item.compliance}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Priority alerts - plates with missing properties */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3">
            Placas com Pendências Impeditivas
          </h3>

          {problematicPlates.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-450 italic font-medium">
              Nenhuma placa com documentos exigíveis em falta ou atualmente vencidos.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {problematicPlates.map(item => (
                <div key={item.plate} className="text-xs p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 shadow-xs px-1.5 py-0.5 rounded text-[11px]">
                      {item.plate}
                    </span>
                    <span className="text-[9px] block text-slate-500 font-bold mt-1 uppercase tracking-tight">{item.company}</span>
                  </div>

                  <div className="text-right space-y-0.5 text-[10px] font-bold">
                    {item.expiredCount > 0 && (
                      <span className="block text-rose-605 font-bold">{item.expiredCount} vencidos</span>
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-4 mb-4 flex items-center gap-1.5">
          <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
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
                <div key={log.id} className="text-xs p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between gap-4 shadow-xs hover:bg-slate-100/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold text-[11px] shadow-xs">
                        {log.placa}
                      </span>
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 rounded uppercase">
                        {log.empresaId}
                      </span>
                      <span className="font-bold text-slate-800">{log.campoAlterado}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 font-semibold">
                      Modificação: De <span className="text-slate-400 line-through font-normal">{log.valorAnterior || 'Em branco'}</span> para <strong className="text-blue-600 font-extrabold">{log.valorNovo}</strong>
                    </p>

                    {log.observacao && (
                      <p className="text-[11px] text-slate-500 italic pl-2 border-l-2 border-blue-400 mt-1 font-semibold">
                        Justificativa inserida: "{log.observacao}"
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 md:text-right shrink-0 font-medium">
                    <div className="flex items-center md:justify-end gap-1 font-bold text-slate-700">
                      <User className="h-3 w-3 inline text-slate-400" />
                      {log.usuarioNome}
                    </div>
                    <span className="block mt-0.5 font-mono text-[9px] text-slate-400">
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
