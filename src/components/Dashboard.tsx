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
import { Veiculo, Documento, Empresa } from '../types';
import { dbInLocalStorage, formatarDataBR } from '../utils/mockdb';
import { obterNomeEmpresa } from '../utils/empresaUtils';

interface DashboardProps {
  onNavigateToVehicles: (plateSearch?: string) => void;
  onNavigateToDocuments: (plateSearch?: string) => void;
  selectedEmpresaGlobal: string;
  setSelectedEmpresaGlobal: (emp: string) => void;
}

export default function Dashboard({ 
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
  const allPlates = useMemo(() => vehicles.map(v => v.placa).sort(), [vehicles]);
  
  const coupledSets = useMemo(() => {
    // Only return vehicles of type Cavalo that HAVE a linked trailer, or vice versa
    return vehicles.filter(v => v.tipoUnidade === 'Cavalo' && v.carretaVinculadaId);
  }, [vehicles]);

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
    let finalVehicles = [...vehicles];
    
    // Apply global company filter if set (if activeTab is not already 'empresa', or apply globally)
    if (selectedEmpresaGlobal) {
      finalVehicles = finalVehicles.filter(v => v.empresaId === selectedEmpresaGlobal);
    }

    // Apply specific Dashboard Tab Filters
    if (activeTab === 'empresa') {
      finalVehicles = vehicles.filter(v => v.empresaId === selectedEmpresaLocal);
    } else if (activeTab === 'tipo') {
      finalVehicles = vehicles.filter(v => v.tipoUnidade === selectedTipoLocal);
    } else if (activeTab === 'placa') {
      finalVehicles = vehicles.filter(v => v.placa === selectedPlacaLocal);
    } else if (activeTab === 'conjunto') {
      const cavaloObj = vehicles.find(v => v.id === selectedConjuntoLocal);
      if (cavaloObj) {
        const carretaObj = vehicles.find(v => v.id === cavaloObj.carretaVinculadaId);
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
  }, [vehicles, documents, activeTab, selectedEmpresaGlobal, selectedEmpresaLocal, selectedTipoLocal, selectedPlacaLocal, selectedConjuntoLocal]);

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

  // Identify next critical upcoming expirations ordered by urgency
  const cleanExpDocuments = useMemo(() => {
    return documents
      .filter(d => d.aplicavel && (d.statusDocumento === 'Vencido' || d.statusDocumento === 'Crítico' || d.statusDocumento === 'Atenção'))
      .sort((a, b) => {
        if (!a.dataVencimento) return 1;
        if (!b.dataVencimento) return -1;
        return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
      })
      .slice(0, 6);
  }, [documents]);

  // Ranking of Vehicles with highest counts of pending items
  const vehiclePendenciesRanking = useMemo(() => {
    const counts: { [placa: string]: { plate: string, company: string, count: number, types: string[] } } = {};
    
    documents.forEach(d => {
      if (d.aplicavel && (d.statusDocumento === 'Vencido' || d.statusDocumento === 'Crítico')) {
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
  }, [documents]);

  const selectLayoutHelp = () => {
    switch(activeTab) {
      case 'geral': return 'Exibindo dados consolidados de todos os veículos cadastrados.';
      case 'empresa': return 'Analise os veículos e as conformidades de uma divisão corporativa específica.';
      case 'tipo': return 'Filtre por Cavalo Mecânico, Implementos de Estrada, Truck, etc.';
      case 'placa': return 'Consulte o histórico de documentos e alertas de uma placa individual de imediato.';
      case 'conjunto': return 'Veja os documentos integrados das composições Cavalo + Carreta atuantes.';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Title & Slogan */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <Compass className="text-blue-600 h-6 w-6" />
            Painel Geral de Conformidade
          </h1>
          <p className="text-sm text-slate-500">
            Acompanhamento de documentos exigíveis (CIV, CIPP, INMETRO, Tacógrafo e Laudos).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Global Company Filter shortcut */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Lente de Divisão:</span>
            <select 
              id="global-company-select"
              className="bg-white border border-slate-200 text-slate-800 font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-sm transition-all"
              value={selectedEmpresaGlobal}
              onChange={(e) => setSelectedEmpresaGlobal(e.target.value)}
            >
              <option value="">TODAS AS EMPRESAS</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companies)}</option>
              ))}
            </select>
            {selectedEmpresaGlobal && (
              <button 
                onClick={() => setSelectedEmpresaGlobal('')} 
                className="text-blue-600 hover:text-blue-700 font-bold ml-1 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Segmented View Selectors */}
      <div className="p-1.5 bg-slate-200/55 border border-slate-200/80 w-fit rounded-xl flex flex-wrap gap-1">
        <button
          id="tab-view-geral"
          onClick={() => setActiveTab('geral')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'geral' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Visão Geral
        </button>
        <button
          id="tab-view-empresa"
          onClick={() => setActiveTab('empresa')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'empresa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Por Empresa
        </button>
        <button
          id="tab-view-tipo"
          onClick={() => setActiveTab('tipo')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'tipo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Por Tipo de Unidade
        </button>
        <button
          id="tab-view-placa"
          onClick={() => setActiveTab('placa')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'placa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Por Placa
        </button>
        <button
          id="tab-view-conjunto"
          onClick={() => setActiveTab('conjunto')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'conjunto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Por Conjunto Cavalo+Carreta
        </button>
      </div>

      {/* Conditional Sub-filters Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm">
        <span className="text-slate-500 italic">
          {selectLayoutHelp()}
        </span>

        {/* Dynamic Selectors depending on active Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'empresa' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Empresa:</span>
              <select
                id="tab-filter-company"
                value={selectedEmpresaLocal}
                onChange={(e) => setSelectedEmpresaLocal(e.target.value)}
                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium shadow-sm cursor-pointer"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companies)}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'tipo' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Tipo de Unidade:</span>
              <select
                id="tab-filter-type"
                value={selectedTipoLocal}
                onChange={(e) => setSelectedTipoLocal(e.target.value)}
                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium shadow-sm cursor-pointer"
              >
                <option value="Cavalo">Cavalo</option>
                <option value="Carreta">Carreta</option>
                <option value="Porta Container">Porta Container</option>
                <option value="Truck">Truck</option>
                <option value="Toco">Toco</option>
                <option value="Bitruck">Bitruck</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          )}

          {activeTab === 'placa' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Selecionar Placa:</span>
              <select
                id="tab-filter-plate"
                value={selectedPlacaLocal}
                onChange={(e) => setSelectedPlacaLocal(e.target.value)}
                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono shadow-sm cursor-pointer"
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
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Selecionar Conjunto Ativo:</span>
              <select
                id="tab-filter-composition"
                value={selectedConjuntoLocal}
                onChange={(e) => setSelectedConjuntoLocal(e.target.value)}
                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono shadow-sm cursor-pointer"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Compliance Circle Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
              Índice Conformidade
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900">{metrics.complianceRate}%</span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">no filtro</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              {metrics.totalAplicaveis} documentos aplicáveis avaliados.
            </p>
          </div>
          
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Visual Circular Gauge */}
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" className="stroke-slate-100" strokeWidth="4" fill="transparent" />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                className="stroke-blue-600" 
                strokeWidth="5" 
                fill="transparent" 
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - metrics.complianceRate / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <TrendingUp className="absolute text-blue-600 h-5 w-5" />
          </div>
        </div>

        {/* Total Vehicles count details */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-2 w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest block">
              Frota Vinculada
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{metrics.totalVehicles}</span>
              <span className="text-xs text-slate-500">Veículos</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
              <div>Cavalos: <strong className="text-slate-800">{metrics.totalCavalos}</strong></div>
              <div>Carretas: <strong className="text-slate-800">{metrics.totalCarretas}</strong></div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        {/* High Risk Critical/Expired */}
        <div id="kpi-critical" className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-widest block">
              Alerta Crítico / Vencidos
            </span>
            <span className="text-3xl font-extrabold text-slate-900">
              {metrics.criticos + metrics.vencidos}
            </span>
            <p className="text-[11px] text-slate-500 leading-tight">
              <strong className="text-rose-600 font-semibold">{metrics.vencidos} já vencidos</strong>, {metrics.criticos} vencem em 30 dias.
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Warning Expirations (31-60 days) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest block">
              Documentos em Atenção
            </span>
            <span className="text-3xl font-extrabold text-slate-900">
              {metrics.atencao}
            </span>
            <p className="text-[11px] text-slate-500 leading-tight">
              Vencimentos programados para 31 a 60 dias.
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Segmented Document Compliance Bar Distribution Indicator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-4">
          Distribuição dos Status de Documentos Exigíveis
        </h3>
        {/* Compact Stacked Percent Block */}
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex select-none mb-3">
          {metrics.totalAplicaveis === 0 ? (
            <div className="w-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
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
                className="bg-rose-700 h-full hover:brightness-110 transition-all cursor-help"
              />
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap gap-4">
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
              <span className="w-2.5 h-2.5 bg-rose-700 rounded-full block"></span>
              Vencidos: <strong className="text-rose-700">{metrics.vencidos}</strong>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 italic">
            *Docs marcados como não aplicáveis/isentos são desconsiderados deste gráfico e índice de conformidade.
          </div>
        </div>
      </div>

      {/* Main Corporate Indicators & Rankings by Company */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Indicators Separated by Empresa (Crucial Corporate Requirement) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Building2 className="text-blue-600 h-4.5 w-4.5" />
              Indicadores por Empresa da Frota
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 bg-blue-50 px-20 py-0.5 rounded">
              Visão Corporativa
            </span>
          </div>

          <div className="space-y-3.5">
            {statsByCompany.length === 0 && (
              <div className="p-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl">
                Nenhum indicador por empresa encontrado. Verifique se os veículos possuem empresaId compatível com as empresas.
              </div>
            )}

            {statsByCompany.map((comp) => (
              <div 
                key={comp.companyId}
                className={`p-3.5 rounded-xl border transition-all ${
                  selectedEmpresaGlobal === comp.companyId 
                    ? 'bg-blue-50/40 border-blue-200' 
                    : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full" />
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">{comp.company}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Conformidade:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      comp.compliance >= 90 ? 'text-emerald-700 bg-emerald-50 shadow-sm' :
                      comp.compliance >= 70 ? 'text-amber-700 bg-amber-50 shadow-sm' : 'text-rose-700 bg-rose-50 shadow-sm'
                    }`}>
                      {comp.compliance}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-medium">Frota</span>
                    <span className="text-xs font-semibold text-slate-700">{comp.vehiclesCount} un.</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-rose-600 uppercase font-medium">Vencidos</span>
                    <span className={`text-xs font-bold ${comp.vencidos > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {comp.vencidos}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-amber-600 uppercase font-medium">Prazo Crítico</span>
                    <span className="text-xs font-semibold text-amber-600">{comp.criticos}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Filter Reminder */}
          <p className="text-[10px] text-slate-400 italic mt-2">
            Clique em "Lente de Divisão" no topo superior direito para analisar apenas uma destas empresas em todo o sistema.
          </p>
        </div>

        {/* Right Col: Priority Lists and Alerts */}
        <div className="space-y-6">
          
          {/* Top Pending Vehicles Ranking */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 border-b border-slate-100 pb-3">
              Maior Acúmulo de Pendências
            </h3>

            {vehiclePendenciesRanking.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Parabéns! Todos os ativos aplicáveis estão conformes.
              </div>
            ) : (
              <div className="space-y-3">
                {vehiclePendenciesRanking.map((item, idx) => (
                  <div key={item.plate} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 hover:bg-slate-100/50 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.plate}
                        </span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-600 font-medium rounded-sm">
                          {item.company}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">
                        {item.types.join(' • ')}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => onNavigateToVehicles(item.plate)}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span className="px-2 py-1 bg-blue-50 rounded-md">
                        {item.count} pend.
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Core Notification Alert Stream */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 border-b border-slate-100 pb-3">
              Notificação de Vencimento Próximos
            </h3>

            {cleanExpDocuments.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Nenhum documento prestes a expirar.
              </div>
            ) : (
              <div className="space-y-3">
                {cleanExpDocuments.map((doc) => {
                  const isVencido = doc.statusDocumento === 'Vencido';
                  return (
                    <div key={doc.id} className="text-xs p-2.5 rounded-xl border border-slate-150 bg-slate-50 flex items-start gap-2 justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isVencido ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-sm' : 'bg-amber-50 text-amber-600 border border-amber-100 shadow-sm'
                          }`}>
                            {doc.tipoDocumento}
                          </span>
                          <span className="font-mono font-semibold text-slate-800">
                            {doc.placa}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Vencimento: <strong className={isVencido ? 'text-rose-600' : 'text-slate-700'}>
                            {formatarDataBR(doc.dataVencimento)}
                          </strong>
                        </p>
                      </div>

                      <button
                        onClick={() => onNavigateToDocuments(doc.placa)}
                        className="p-1 px-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-[10px] text-blue-600 font-semibold rounded-md flex items-center gap-1 cursor-pointer transition-colors"
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
