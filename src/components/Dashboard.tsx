/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, CheckCircle2, AlertTriangle, XCircle, 
  HelpCircle, Eye, FileText, ArrowRight,
  TrendingUp, Award, Layers, Compass, Tag, Group
} from 'lucide-react';
import { Veiculo, Documento, Empresa, Usuario } from '../types';
import { dbInLocalStorage, formatarDataBR } from '../utils/mockdb';
import { obterNomeEmpresa } from '../utils/empresaUtils';
import { getVehicleBaseLabel } from '../utils/vehicleBaseUtils';
import { canAccessEmpresa, hasGeneralCompanyAccess } from '../utils/accessControl';

interface DashboardProps {
  currentUser: Usuario;
  onNavigateToVehicles: (plateSearch?: string) => void;
  onNavigateToDocuments: (plateSearch?: string) => void;
  selectedEmpresaGlobal: string;
  setSelectedEmpresaGlobal: (emp: string) => void;
}

export default function Dashboard({ 
  currentUser,
  onNavigateToVehicles, 
  onNavigateToDocuments,
  selectedEmpresaGlobal,
  setSelectedEmpresaGlobal 
}: DashboardProps) {
  
  // Local state for dashboard views: 'geral' | 'empresa' | 'tipo' | 'placa' | 'conjunto'
  const [activeTab, setActiveTab] = useState<'geral' | 'empresa' | 'tipo' | 'placa' | 'conjunto'>('geral');
  
  // Specific filters within the tabs
  const [selectedEmpresaLocal, setSelectedEmpresaLocal] = useState<string>('empresa-bwt');
  const [selectedTipoLocal, setSelectedTipoLocal] = useState<string>('Cavalo');
  const [selectedPlacaLocal, setSelectedPlacaLocal] = useState<string>('');
  const [selectedConjuntoLocal, setSelectedConjuntoLocal] = useState<string>(''); // Cavalo ID

  // Trigger state to capture updates from Neon
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener('mockdb-update', handleUpdate);
    return () => window.removeEventListener('mockdb-update', handleUpdate);
  }, []);

  // Fetch all current database entities
  const vehicles = useMemo(() => dbInLocalStorage.getVehicles(), [updateTrigger]);
  const documents = useMemo(() => dbInLocalStorage.getDocuments(), [updateTrigger]);


  const companies = useMemo(() => {
    const dbCompanies = ((dbInLocalStorage as any).getCompanies?.() || []) as Empresa[];

    if (dbCompanies.length > 0) {
      return dbCompanies;
    }

    const empresasIds: string[] = Array.from(
      new Set<string>(
        vehicles
          .map((v) => v.empresaId)
          .filter((empresaId): empresaId is string => Boolean(empresaId))
      )
    );

    return empresasIds.map((empresaId) => ({
      id: empresaId,
      nomeEmpresa: obterNomeEmpresa(empresaId),
      status: 'ativo',
      dataCadastro: '',
    })) as Empresa[];
  }, [vehicles, updateTrigger]);

  // Derive sets for selections
  const activeVehicles = useMemo(() => vehicles.filter(v => v.status === 'ativo' && canAccessEmpresa(currentUser, v.empresaId)), [vehicles, currentUser]);
  const activeVehicleIds = useMemo(() => new Set(activeVehicles.map(v => v.id)), [activeVehicles]);
  const allPlates = useMemo(() => activeVehicles.map(v => v.placa).sort(), [activeVehicles]);
  
  const coupledSets = useMemo(() => {
    // Only return vehicles of type Cavalo that HAVE a linked trailer, or vice versa
    return activeVehicles.filter(v => v.tipoUnidade === 'Cavalo' && v.carretaVinculadaId);
  }, [activeVehicles]);

  // Set default selection values once if empty
  useMemo(() => {
    if (!selectedPlacaLocal && allPlates.length > 0) {
      setSelectedPlacaLocal(allPlates[0]);
    }
    if (!selectedConjuntoLocal && coupledSets.length > 0) {
      setSelectedConjuntoLocal(coupledSets[0].id);
    }
  }, [allPlates, coupledSets]);

  // Perform filtering of Vehicles & Documents based on BOTH global active view type AND active selection
  const filteredData = useMemo(() => {
    let finalVehicles = [...activeVehicles];
    
    // Apply global company filter if set (if activeTab is not already 'empresa', or apply globally)
    if (selectedEmpresaGlobal) {
      finalVehicles = finalVehicles.filter(v => v.empresaId === selectedEmpresaGlobal);
    }

    // Apply specific Dashboard Tab Filters
    if (activeTab === 'empresa') {
      finalVehicles = activeVehicles.filter(v => v.empresaId === selectedEmpresaLocal);
    } else if (activeTab === 'tipo') {
      finalVehicles = activeVehicles.filter(v => v.tipoUnidade === selectedTipoLocal);
    } else if (activeTab === 'placa') {
      finalVehicles = activeVehicles.filter(v => v.placa === selectedPlacaLocal);
    } else if (activeTab === 'conjunto') {
      const cavaloObj = activeVehicles.find(v => v.id === selectedConjuntoLocal);
      if (cavaloObj) {
        const carretaObj = activeVehicles.find(v => v.id === cavaloObj.carretaVinculadaId);
        finalVehicles = [cavaloObj, ...(carretaObj ? [carretaObj] : [])];
      } else {
        finalVehicles = [];
      }
    }

    const vehicleIds = new Set(finalVehicles.map(v => v.id));
    const finalDocuments = documents.filter(d => vehicleIds.has(d.veiculoId));

    return {
      vehicles: finalVehicles,
      documents: finalDocuments
    };
  }, [activeVehicles, documents, activeTab, selectedEmpresaGlobal, selectedEmpresaLocal, selectedTipoLocal, selectedPlacaLocal, selectedConjuntoLocal]);

  // Document Metrics Engine
  const metrics = useMemo(() => {
    const docs = filteredData.documents;
    
    let total = docs.length;
    let validos = 0;
    let atencao = 0;
    let criticos = 0;
    let vencidos = 0;
    let naoAplicaveis = 0;

    docs.forEach(d => {
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
    const compliant = validos + atencao;
    const complianceRate = totalAplicaveis > 0 ? Math.round((compliant / totalAplicaveis) * 100) : 100;

    // Vehicle statistics
    const totalVehicles = filteredData.vehicles.length;
    const totalCavalos = filteredData.vehicles.filter(v => v.tipoUnidade === 'Cavalo').length;
    const totalCarretas = filteredData.vehicles.filter(v => v.tipoUnidade === 'Carreta' || v.tipoUnidade === 'Porta Container').length;

    return {
      total,
      validos,
      atencao,
      criticos,
      vencidos,
      naoAplicaveis,
      totalAplicaveis,
      complianceRate,
      totalVehicles,
      totalCavalos,
      totalCarretas
    };
  }, [filteredData]);

// Metrics segmented by Company
const statsByCompany = useMemo(() => {
  const companiesList = Array.isArray(companies)
    ? companies
    : companies?.records || [];

  const vehiclesList = Array.isArray(vehicles)
    ? vehicles
    : vehicles?.records || [];

  const documentsList = Array.isArray(documents)
    ? documents
    : documents?.records || [];

  return companiesList
    .map((comp) => {
      const compVehicles = vehiclesList.filter(
        (v) => v.empresaId === comp.id && v.status !== 'inativo'
      );

      const vehicleIds = new Set(compVehicles.map((v) => v.id));

      const compDocs = documentsList.filter((d) => vehicleIds.has(d.veiculoId));

      let total = compDocs.length;
      let validos = 0;
      let atencao = 0;
      let criticos = 0;
      let vencidos = 0;
      let naoAplicaveis = 0;

      compDocs.forEach((d) => {
        if (d.aplicavel === false) {
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
      const compliant = validos + atencao;

      const compliance =
        totalAplicaveis > 0
          ? Math.round((compliant / totalAplicaveis) * 100)
          : 100;

      const totalPendencias = vencidos + criticos;

      return {
        companyId: comp.id,
        company: obterNomeEmpresa(comp.id, companies),
        vehiclesCount: compVehicles.length,
        documentosCount: total,
        vencidos,
        criticos,
        totalPendencias,
        compliance,
      };
    })
    .filter((comp) => comp.vehiclesCount > 0 || comp.documentosCount > 0)
    .sort((a, b) => b.totalPendencias - a.totalPendencias);
}, [vehicles, documents, companies]);

  // Próximos vencimentos: mostra somente documentos que ainda vão vencer.
  // Documentos já vencidos continuam contabilizados nos KPIs, mas não entram nesta lista.
  const cleanExpDocuments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return documents
      .filter((d) => {
        if (!activeVehicleIds.has(d.veiculoId)) return false;
        if (!d.aplicavel) return false;
        if (!d.dataVencimento) return false;
        if (d.statusDocumento === 'Vencido') return false;

        const expirationDate = new Date(d.dataVencimento);
        expirationDate.setHours(0, 0, 0, 0);

        return expirationDate >= today;
      })
      .sort((a, b) => {
        return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
      })
      .slice(0, 6);
  }, [documents, activeVehicleIds]);

  // Ranking of Vehicles with highest counts of pending items
  const vehiclePendenciesRanking = useMemo(() => {
    const counts: { [placa: string]: { plate: string, company: string, count: number, types: string[] } } = {};
    
    documents.forEach(d => {
      if (activeVehicleIds.has(d.veiculoId) && d.aplicavel && (d.statusDocumento === 'Vencido' || d.statusDocumento === 'Crítico')) {
        if (!counts[d.placa]) {
          counts[d.placa] = { plate: d.placa, company: obterNomeEmpresa(d.empresaId, companies), count: 0, types: [] };
        }
        counts[d.placa].count++;
        counts[d.placa].types.push(d.tipoDocumento);
      }
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [documents, activeVehicleIds]);

  const obterChaveEmpresa = (empresaId: string, nomeEmpresa?: string) => {
    return `${empresaId} ${nomeEmpresa || ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const obterLogoEmpresa = (empresaId: string, nomeEmpresa?: string) => {
    const chaveEmpresa = obterChaveEmpresa(empresaId, nomeEmpresa);

    if (chaveEmpresa.includes('bwt')) {
      return '/logo-bwt.png';
    }

    if (chaveEmpresa.includes('potencial') && chaveEmpresa.includes('combust')) {
      return '/logo-potencial-combustiveis.png';
    }

    if (chaveEmpresa.includes('potencial') && chaveEmpresa.includes('agro')) {
      return '/logo-potencial-agro.png';
    }

    if (chaveEmpresa.includes('bwi')) {
      return '/logo-bwi.png';
    }

    if (chaveEmpresa.includes('jeta')) {
      return '/logo-jeta.png';
    }

    return '';
  };

  const obterClasseLogoEmpresa = (empresaId: string, nomeEmpresa?: string) => {
    const chaveEmpresa = obterChaveEmpresa(empresaId, nomeEmpresa);

    if (chaveEmpresa.includes('potencial') && chaveEmpresa.includes('combust')) {
      return 'max-h-16 max-w-[220px] object-contain';
    }

    if (chaveEmpresa.includes('potencial') && chaveEmpresa.includes('agro')) {
      return 'max-h-16 max-w-[220px] object-contain';
    }

    if (chaveEmpresa.includes('bwi')) {
      return 'max-h-9 max-w-[145px] object-contain';
    }

    if (chaveEmpresa.includes('bwt')) {
      return 'max-h-14 max-w-[205px] object-contain';
    }

    if (chaveEmpresa.includes('jeta')) {
      return 'max-h-14 max-w-[205px] object-contain';
    }

    return 'max-h-12 max-w-[185px] object-contain';
  };

  const selectLayoutHelp = () => {
    switch(activeTab) {
      case 'geral': return 'Exibindo dados consolidados de todos os veículos cadastrados.';
      case 'empresa': return 'Analise os veículos e as conformidades de uma divisão corporativa específica.';
      case 'tipo': return 'Filtre por Cavalo Mecânico, Implementos de Estrada, Truck, etc.';
      case 'placa': return 'Consulte o histórico de documentos e alertas de uma placa individual de imediato.';
      case 'conjunto': return 'Veja os documentos integrados das composições Cavalo + Carreta atuantes.';
    }
  };

  const activeEmpresaLabel = selectedEmpresaGlobal
    ? obterNomeEmpresa(selectedEmpresaGlobal, companies)
    : 'Todas as empresas';

  const dashboardTabs: { id: typeof activeTab; label: string }[] = [
    { id: 'geral', label: 'Visão Geral' },
    { id: 'empresa', label: 'Por Empresa' },
    { id: 'tipo', label: 'Por Tipo de Unidade' },
    { id: 'placa', label: 'Por Placa' },
    { id: 'conjunto', label: 'Por Conjunto Cavalo+Carreta' },
  ];

  const baseSelectClass =
    'bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 transition-all font-semibold shadow-sm cursor-pointer';

  const complianceBadgeClass = (compliance: number) =>
    compliance >= 90
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
      : compliance >= 70
        ? 'text-amber-700 bg-amber-50 border-amber-100'
        : 'text-rose-700 bg-rose-50 border-rose-100';

  return (
    <div className="space-y-7 pb-8">
      {/* Grupo Potencial corporate hero */}
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
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-200 ring-1 ring-white/15">
                  <Award className="h-3.5 w-3.5" />
                  Grupo Potencial
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200 ring-1 ring-emerald-300/20">
                  Gestão integrada de frota
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                Painel Geral de Conformidade
              </h1>
              <p className="mt-2 max-w-3xl text-sm md:text-base text-blue-100/85 font-medium leading-relaxed">
                Controle executivo dos documentos, laudos e vencimentos da frota com foco em segurança, logística eficiente e governança operacional.
              </p>
            </div>
          </div>

          <div className="w-full xl:w-[360px] rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-md shadow-lg shadow-slate-950/20">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-blue-100/70">
                  Filtro corporativo
                </span>
                <strong className="block text-sm text-white truncate pt-0.5">
                  {activeEmpresaLabel}
                </strong>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-300/15 text-amber-200 flex items-center justify-center ring-1 ring-amber-200/20">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            <select
              id="global-company-select"
              className="w-full bg-white text-slate-900 border border-white/80 font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300/60 shadow-sm transition-all"
              value={selectedEmpresaGlobal}
              onChange={(e) => setSelectedEmpresaGlobal(e.target.value)}
            >
              {hasGeneralCompanyAccess(currentUser) && <option value="">TODAS AS EMPRESAS</option>}
              {companies.filter(c => canAccessEmpresa(currentUser, c.id)).map(c => (
                <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companies)}</option>
              ))}
            </select>

            {selectedEmpresaGlobal && (
              <button
                onClick={() => setSelectedEmpresaGlobal('')}
                className="mt-3 text-xs font-extrabold uppercase tracking-wider text-amber-200 hover:text-white transition-colors cursor-pointer"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/70">Conformidade</span>
            <div className="mt-1 text-2xl font-black text-white">{metrics.complianceRate}%</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/70">Frota no filtro</span>
            <div className="mt-1 text-2xl font-black text-white">{metrics.totalVehicles}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/70">Pendências críticas</span>
            <div className="mt-1 text-2xl font-black text-rose-100">{metrics.criticos + metrics.vencidos}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/70">Documentos avaliados</span>
            <div className="mt-1 text-2xl font-black text-white">{metrics.totalAplicaveis}</div>
          </div>
        </div>
      </motion.div>

      {/* Segmented View Selectors */}
      <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-200/60 flex flex-wrap gap-1">
        {dashboardTabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-view-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-extrabold rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-950 text-white shadow-md shadow-slate-950/15'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conditional Sub-filters Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm shadow-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-sm">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 ring-1 ring-blue-100">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Modo de análise
            </span>
            <span className="text-slate-600 font-medium italic">
              {selectLayoutHelp()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'empresa' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Empresa:</span>
              <select
                id="tab-filter-company"
                value={selectedEmpresaLocal}
                onChange={(e) => setSelectedEmpresaLocal(e.target.value)}
                className={baseSelectClass}
              >
                {companies.filter(c => canAccessEmpresa(currentUser, c.id)).map(c => (
                  <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companies)}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'tipo' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Tipo:</span>
              <select
                id="tab-filter-type"
                value={selectedTipoLocal}
                onChange={(e) => setSelectedTipoLocal(e.target.value)}
                className={baseSelectClass}
              >
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
          )}

          {activeTab === 'placa' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Placa:</span>
              <select
                id="tab-filter-plate"
                value={selectedPlacaLocal}
                onChange={(e) => setSelectedPlacaLocal(e.target.value)}
                className={`${baseSelectClass} font-mono`}
              >
                {allPlates.length === 0 ? (
                  <option value="">Sem placas no filtro</option>
                ) : (
                  allPlates.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))
                )}
              </select>
            </div>
          )}

          {activeTab === 'conjunto' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Conjunto:</span>
              <select
                id="tab-filter-composition"
                value={selectedConjuntoLocal}
                onChange={(e) => setSelectedConjuntoLocal(e.target.value)}
                className={`${baseSelectClass} font-mono`}
              >
                {coupledSets.length === 0 ? (
                  <option value="">Nenhum conjunto acoplado ativo</option>
                ) : (
                  coupledSets.map(c => {
                    const trailer = vehicles.find(v => v.id === c.carretaVinculadaId);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.placa} ({c.modelo}) + {trailer ? trailer.placa : 'S/ reboque'}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid of 4 Core KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 min-h-[162px] flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-blue-950/10 transition-all"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-900 via-blue-600 to-amber-400" />
          <div className="space-y-1 relative z-10">
            <span className="text-xs font-black text-blue-900 uppercase tracking-[0.18em]">
              Índice Conformidade
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-slate-950">{metrics.complianceRate}%</span>
              <span className="text-[10px] text-amber-600 font-black uppercase tracking-wider">no filtro</span>
            </div>
            <p className="text-sm text-slate-500 leading-tight">
              {metrics.totalAplicaveis} documentos aplicáveis avaliados.
            </p>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" className="stroke-blue-50" strokeWidth="4" fill="transparent" />
              <circle
                cx="32"
                cy="32"
                r="28"
                className="stroke-blue-800"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - metrics.complianceRate / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <TrendingUp className="absolute text-blue-800 h-5 w-5" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 min-h-[162px] flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-slate-950/10 transition-all"
        >
          <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-blue-50" />
          <div className="space-y-2 w-full relative z-10">
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.18em] block">
              Frota Vinculada
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-950">{metrics.totalVehicles}</span>
              <span className="text-xs text-slate-500 font-bold">Veículos</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div>Cavalos: <strong className="text-blue-900">{metrics.totalCavalos}</strong></div>
              <div>Carretas: <strong className="text-blue-900">{metrics.totalCarretas}</strong></div>
            </div>
          </div>
          <div className="p-3 bg-blue-900 text-white rounded-2xl shrink-0 shadow-lg shadow-blue-900/20 relative z-10">
            <Layers className="h-6 w-6" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          id="kpi-critical"
          className="group relative overflow-hidden rounded-3xl border border-rose-100 bg-white p-6 min-h-[162px] flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-rose-950/10 transition-all"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-700 to-amber-400" />
          <div className="space-y-1 relative z-10">
            <span className="text-xs font-black text-rose-700 uppercase tracking-[0.18em] block">
              Alerta Crítico / Vencidos
            </span>
            <span className="text-4xl font-black text-slate-950">
              {metrics.criticos + metrics.vencidos}
            </span>
            <p className="text-sm text-slate-500 leading-tight">
              <strong className="text-rose-600 font-black">{metrics.vencidos} já vencidos</strong>, {metrics.criticos} vencem em 30 dias.
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0 ring-1 ring-rose-100">
            <XCircle className="h-6 w-6" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-3xl border border-amber-100 bg-white p-6 min-h-[162px] flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-amber-950/10 transition-all"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-blue-800" />
          <div className="space-y-1 relative z-10">
            <span className="text-xs font-black text-amber-700 uppercase tracking-[0.18em] block">
              Documentos em Atenção
            </span>
            <span className="text-4xl font-black text-slate-950">
              {metrics.atencao}
            </span>
            <p className="text-sm text-slate-500 leading-tight">
              Vencimentos programados para 31 a 60 dias.
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0 ring-1 ring-amber-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </motion.div>
      </div>

      {/* Segmented Document Compliance Bar Distribution Indicator */}
      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 shadow-sm shadow-slate-200/70">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-blue-50/80" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800">
              Distribuição dos Status de Documentos Exigíveis
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Leitura rápida da saúde documental da operação selecionada.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-800 ring-1 ring-blue-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Governança documental
          </span>
        </div>

        <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex select-none mb-4 ring-1 ring-slate-100">
          {metrics.totalAplicaveis === 0 ? (
            <div className="w-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
              Nenhum documento aplicável registrado para este filtro.
            </div>
          ) : (
            <>
              <div
                title="Válidos"
                style={{ width: `${(metrics.validos / metrics.totalAplicaveis) * 100}%` }}
                className="bg-emerald-500 h-full hover:brightness-110 transition-all cursor-help"
              />
              <div
                title="Em Atenção"
                style={{ width: `${(metrics.atencao / metrics.totalAplicaveis) * 100}%` }}
                className="bg-amber-500 h-full hover:brightness-110 transition-all cursor-help"
              />
              <div
                title="Críticos"
                style={{ width: `${(metrics.criticos / metrics.totalAplicaveis) * 100}%` }}
                className="bg-rose-500 h-full hover:brightness-110 transition-all cursor-help"
              />
              <div
                title="Vencidos"
                style={{ width: `${(metrics.vencidos / metrics.totalAplicaveis) * 100}%` }}
                className="bg-rose-800 h-full hover:brightness-110 transition-all cursor-help"
              />
            </>
          )}
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap gap-4 md:gap-6">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full block"></span>
              Válidos: <strong className="text-slate-950">{metrics.validos}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full block"></span>
              Atenção: <strong className="text-slate-950">{metrics.atencao}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full block"></span>
              Críticos: <strong className="text-slate-950">{metrics.criticos}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 bg-rose-800 rounded-full block"></span>
              Vencidos: <strong className="text-rose-700">{metrics.vencidos}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Corporate Indicators & Rankings by Company */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm shadow-slate-200/70 overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-blue-900 via-blue-600 to-amber-400" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 pl-1">
            <h3 className="text-sm font-black text-slate-950 flex items-center gap-2 uppercase tracking-wider">
              <span className="h-9 w-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
                <Building2 className="h-4.5 w-4.5" />
              </span>
              Indicadores por Empresa da Frota
            </h3>
            <span className="text-xs uppercase font-black tracking-[0.18em] text-blue-900 bg-amber-100 px-4 py-1.5 rounded-full border border-amber-200">
              Visão Corporativa
            </span>
          </div>

          <div className="space-y-3.5 relative">
            {statsByCompany.length === 0 && (
              <div className="p-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl font-semibold">
                Nenhum indicador por empresa encontrado. Verifique se os veículos possuem empresaId compatível com as empresas.
              </div>
            )}

            {statsByCompany.map((comp) => (
              <motion.div
                key={comp.companyId}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.18 }}
                className={`p-4 rounded-2xl border transition-all ${
                  selectedEmpresaGlobal === comp.companyId
                    ? 'bg-blue-50/80 border-blue-200 shadow-sm shadow-blue-900/5'
                    : 'bg-slate-50/80 border-slate-200/80 hover:border-blue-200 hover:bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 min-h-[58px]">
                  <div className="flex items-center gap-2 min-w-0 h-14">
                    <span className="w-2.5 h-2.5 bg-blue-800 rounded-full shrink-0 shadow-sm shadow-blue-800/40" />
                    {obterLogoEmpresa(comp.companyId, comp.company) ? (
                      <div className="h-16 w-[225px] flex items-center justify-start">
                        <img
                          src={obterLogoEmpresa(comp.companyId, comp.company)}
                          alt={comp.company}
                          title={comp.company}
                          className={obterClasseLogoEmpresa(comp.companyId, comp.company)}
                        />
                      </div>
                    ) : (
                      <span className="font-black text-slate-800 text-xs sm:text-sm truncate flex items-center h-14">
                        {comp.company}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 sm:self-center">
                    <span className="text-xs text-slate-500 font-bold">Conformidade:</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full border shadow-sm ${complianceBadgeClass(comp.compliance)}`}>
                      {comp.compliance}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center pt-3 border-t border-slate-200/70">
                  <div className="rounded-xl bg-white/70 p-2 border border-slate-100">
                    <span className="block text-[10px] text-slate-500 uppercase font-black tracking-wider">Frota</span>
                    <span className="text-sm font-black text-slate-800">{comp.vehiclesCount} un.</span>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2 border border-slate-100">
                    <span className="block text-[10px] text-rose-600 uppercase font-black tracking-wider">Vencidos</span>
                    <span className={`text-sm font-black ${comp.vencidos > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {comp.vencidos}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2 border border-slate-100">
                    <span className="block text-[10px] text-amber-600 uppercase font-black tracking-wider">Prazo Crítico</span>
                    <span className="text-sm font-black text-amber-600">{comp.criticos}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-slate-400 italic mt-2 pl-1">
            Clique em "Filtro de Empresa" no topo para analisar apenas uma destas empresas em todo o sistema.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm shadow-slate-200/70 overflow-hidden relative">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-50" />
            <h3 className="relative text-xs font-black uppercase tracking-[0.2em] text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-blue-900 text-white flex items-center justify-center">
                <FileText className="h-3.5 w-3.5" />
              </span>
              Maior Acúmulo de Pendências
            </h3>

            {vehiclePendenciesRanking.length === 0 ? (
              <div className="py-7 text-center text-xs text-slate-400 font-semibold">
                Parabéns! Todos os ativos aplicáveis estão conformes.
              </div>
            ) : (
              <div className="space-y-3 relative">
                {vehiclePendenciesRanking.map((item, idx) => (
                  <div key={item.plate} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/80 hover:bg-white hover:border-blue-200 transition-colors">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="h-6 w-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-mono font-black text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {item.plate}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md border border-blue-100">
                          {item.company}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 block truncate max-w-[180px]">
                        {item.types.join(' • ')}
                      </span>
                    </div>

                    <button
                      onClick={() => onNavigateToVehicles(item.plate)}
                      className="text-xs font-black text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span className="px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
                        {item.count} pend.
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm shadow-slate-200/70 overflow-hidden relative">
            <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-amber-50" />
            <h3 className="relative text-xs font-black uppercase tracking-[0.2em] text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              Notificação de Vencimentos Próximos
            </h3>

            {cleanExpDocuments.length === 0 ? (
              <div className="py-7 text-center text-xs text-slate-400 font-semibold">
                Nenhum documento prestes a expirar.
              </div>
            ) : (
              <div className="space-y-3 relative">
                {cleanExpDocuments.map((doc) => {
                  const isVencido = doc.statusDocumento === 'Vencido';
                  return (
                    <div key={doc.id} className="text-xs p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-2 justify-between hover:bg-white hover:border-amber-200 transition-colors">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg border ${
                            isVencido ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {doc.tipoDocumento}
                          </span>
                          <span className="font-mono font-black text-slate-800">
                            {doc.placa}
                          </span>
                          {getVehicleBaseLabel(activeVehicles.find(v => v.id === doc.veiculoId || v.placa === doc.placa)) && (
                            <span className="text-[11px] bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5 font-black">
                              {getVehicleBaseLabel(activeVehicles.find(v => v.id === doc.veiculoId || v.placa === doc.placa))}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">
                          Vencimento: <strong className={isVencido ? 'text-rose-600' : 'text-slate-700'}>
                            {formatarDataBR(doc.dataVencimento)}
                          </strong>
                        </p>
                      </div>

                      <button
                        onClick={() => onNavigateToDocuments(doc.placa)}
                        className="p-1.5 px-2.5 border border-slate-200 hover:border-blue-200 bg-white hover:bg-blue-50 text-xs text-blue-700 font-black rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      >
                        Renovar
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
