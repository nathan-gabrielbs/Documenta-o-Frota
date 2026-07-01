/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, Calendar, Edit2, AlertTriangle, CheckCircle2, 
  XCircle, Search, HelpCircle, ArrowUpRight, Upload, Info, 
  Plus, Clock, ClipboardList, RefreshCw, X, User
} from 'lucide-react';
import { Documento, Usuario, TipoDocumento, StatusDocumento } from '../types';
import { dbInLocalStorage, calcularStatusDocumento, formatarDataBR } from '../utils/mockdb';
import { canAccessEmpresa, getEffectiveEmpresaFilter } from '../utils/accessControl';
import { EMPRESAS_PADRAO, formatarNomeEmpresaId, obterNomeEmpresa } from '../utils/empresaUtils';
import { getVehicleBaseLabel } from '../utils/vehicleBaseUtils';

interface DocumentsProps {
  currentUser: Usuario;
  initialPlateSearch?: string;
  selectedEmpresaGlobal: string;
}

export default function Documents({ currentUser, initialPlateSearch = '', selectedEmpresaGlobal }: DocumentsProps) {
  
  // Local reactive synced state from DB
  const [documents, setDocuments] = useState<Documento[]>(() => dbInLocalStorage.getDocuments());
  const [vehicles, setVehicles] = useState(() => dbInLocalStorage.getVehicles());
  const [audits, setAudits] = useState(() => dbInLocalStorage.getAudits());

  // Search filter selections
  const [plateQuery, setPlateQuery] = useState(initialPlateSearch);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Active renewing/editing targets
  const [renewingDoc, setRenewingDoc] = useState<Documento | null>(null);

  // Form states for renewal modal
  const [inputEmission, setInputEmission] = useState('');
  const [inputExpiration, setInputExpiration] = useState('');
  const [inputObs, setInputObs] = useState('');
  const [inputJustification, setInputJustification] = useState('');
  const [inputAttachedFileName, setInputAttachedFileName] = useState('');
  const [inputAttachedFileConteudo, setInputAttachedFileConteudo] = useState('');
  const [inputApplicable, setInputApplicable] = useState(true);
  const [formError, setFormError] = useState('');
  const [isSavingRenewal, setIsSavingRenewal] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access rights check
  const canWrite = currentUser.perfil !== 'Consulta';
  const getDocVehicle = (doc: Documento) => vehicles.find(v => v.id === doc.veiculoId || v.placa === doc.placa);

  // Synchronise state with local engine
  const reloadFromDB = () => {
    setDocuments(dbInLocalStorage.getDocuments());
    setVehicles(dbInLocalStorage.getVehicles());
    setAudits(dbInLocalStorage.getAudits());
  };

  useEffect(() => {
    window.addEventListener('mockdb-update', reloadFromDB);
    return () => window.removeEventListener('mockdb-update', reloadFromDB);
  }, []);

  // Evita duas barras de rolagem quando o modal de renovação estiver aberto.
  // Mantém apenas a rolagem interna do modal e bloqueia o scroll da página ao fundo.
  useEffect(() => {
    if (!renewingDoc) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [renewingDoc]);

  const activeVehicleIds = useMemo(() => new Set(vehicles.filter(v => v.status === 'ativo' && canAccessEmpresa(currentUser, v.empresaId)).map(v => v.id)), [vehicles, currentUser]);

  // Perform advanced filters across the list
  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      // Only show documents from active plates/vehicles
      if (!activeVehicleIds.has(d.veiculoId)) return false;
      // Exclude documents that are not applicable
      if (!d.aplicavel) return false;

      // Plate search matched
      const matchesPlate = plateQuery ? d.placa.toLowerCase().includes(plateQuery.toLowerCase()) : true;
      
      // Selectors matched
      const matchesType = typeFilter ? d.tipoDocumento === typeFilter : true;
      const matchesStatus = statusFilter ? d.statusDocumento === statusFilter : true;
      
      if (!canAccessEmpresa(currentUser, d.empresaId)) return false;
      const effectiveCompany = getEffectiveEmpresaFilter(currentUser, selectedEmpresaGlobal, companyFilter);
      const matchesCompany = effectiveCompany ? d.empresaId === effectiveCompany : true;

      return matchesPlate && matchesType && matchesStatus && matchesCompany;
    });
  }, [documents, activeVehicleIds, plateQuery, typeFilter, statusFilter, companyFilter, selectedEmpresaGlobal, currentUser]);

  // Open renewal modal and populate previous properties
  const openRenewModal = (d: Documento) => {
    setRenewingDoc(d);
    setInputEmission(d.dataEmissao);
    setInputExpiration(d.dataVencimento);
    setInputObs(d.observacoes || '');
    setInputJustification('');
    setInputAttachedFileName(d.arquivoAnexo || '');
    setInputAttachedFileConteudo(d.arquivoAnexoConteudo || '');
    setInputApplicable(d.aplicavel);
    setFormError('');
  };

  // Handle active file selection
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearAttachedFile = () => {
    setInputAttachedFileName('');
    setInputAttachedFileConteudo('');
    setIsReadingFile(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readAttachedFile = (file: File) => {
    if (file.size > 750 * 1024) {
      setFormError('O arquivo selecionado excede o limite máximo permitido de 750 KB. Por favor, reduza o tamanho do arquivo ou use um arquivo comprimido.');
      clearAttachedFile();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFormError('');
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setInputAttachedFileName(file.name);
      setInputAttachedFileConteudo(reader.result as string);
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setFormError('Não foi possível ler o arquivo anexado. Tente selecionar o arquivo novamente.');
      clearAttachedFile();
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readAttachedFile(file);
    }
  };

  const handleFileDropReal = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readAttachedFile(file);
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  // Save the modified document + write logs with justification checked
  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingDoc || isSavingRenewal) return;

    if (isReadingFile) {
      setFormError('Aguarde o término da leitura do arquivo anexado antes de salvar.');
      return;
    }

    // Validation checks
    if (inputApplicable) {
      if (!inputEmission) {
        setFormError('Por favor, insira uma data de emissão válida.');
        return;
      }
      if (!inputExpiration) {
        setFormError('Por favor, insira uma data de vencimento válida.');
        return;
      }
      
      const emissionDate = new Date(inputEmission);
      const expirationDate = new Date(inputExpiration);
      if (expirationDate <= emissionDate) {
        setFormError('A data de vencimento deve ser posterior à data de emissão.');
        return;
      }
    }

    // Force justification if expiration date changed manually
    const isDateChanged = renewingDoc.dataVencimento !== inputExpiration;
    if (isDateChanged && !inputJustification.trim()) {
      setFormError('A alteração de vencimento exige o preenchimento de uma justificativa/observação de alteração.');
      return;
    }

    // Capture the parent vehicle object to log the action in company and audits
    const parentVeh = vehicles.find(v => v.id === renewingDoc.veiculoId);
    if (!parentVeh) {
      setFormError('Veículo correspondente não localizado.');
      return;
    }

    // Calculate next dynamic status
    const statusResult = calcularStatusDocumento(inputApplicable, inputExpiration);

    // Save modified doc
    const updatedDocs = documents.map(d => {
      if (d.id === renewingDoc.id) {
        return {
          ...d,
          aplicavel: inputApplicable,
          numeroDocumento: '',
          dataEmissao: inputApplicable ? inputEmission : '',
          dataVencimento: inputApplicable ? inputExpiration : '',
          arquivoAnexo: inputApplicable && inputAttachedFileName ? inputAttachedFileName : undefined,
          arquivoAnexoConteudo: inputApplicable && inputAttachedFileConteudo ? inputAttachedFileConteudo : undefined,
          statusDocumento: statusResult,
          observacoes: inputObs,
          atualizadoPor: currentUser.nome,
          dataAtualizacao: new Date().toISOString()
        };
      }
      return d;
    });

    setIsSavingRenewal(true);
    setFormError('');

    // Optimistic local update so the status changes immediately in the table.
    setDocuments(updatedDocs);

    // Fecha o modal imediatamente após passar pelas validações locais.
    // A gravação no Neon e auditoria continuam em seguida, sem prender a tela aberta.
    const docIdParaAuditoria = renewingDoc.id;
    const tipoDocumentoParaAuditoria = renewingDoc.tipoDocumento;
    const vencimentoAnteriorParaAuditoria = renewingDoc.dataVencimento;
    const tipoAcaoAuditoria = isDateChanged ? 'renovação' : 'edição';

    setRenewingDoc(null);
    setInputEmission('');
    setInputExpiration('');
    setInputObs('');
    setInputJustification('');
    clearAttachedFile();
    setFormError('');

    try {
      await dbInLocalStorage.saveDocuments(updatedDocs);

      try {
        // Log in audits (Requirement 3: Audit manual changes)
        await dbInLocalStorage.logAudit(
          currentUser,
          parentVeh,
          tipoAcaoAuditoria,
          `vencimento do documento ${tipoDocumentoParaAuditoria}`,
          vencimentoAnteriorParaAuditoria ? formatarDataBR(vencimentoAnteriorParaAuditoria) : 'vazio',
          inputApplicable ? formatarDataBR(inputExpiration) : 'Não aplicável',
          inputJustification || 'Atualização cadastral padrão de documento.',
          docIdParaAuditoria,
          tipoDocumentoParaAuditoria
        );
      } catch (auditError) {
        console.warn('Documento salvo, mas não foi possível registrar a auditoria:', auditError);
      }

      reloadFromDB();
    } catch (error) {
      console.error('Erro ao salvar renovação do documento:', error);
      reloadFromDB();
      setFormError('Não foi possível salvar a renovação no Neon. Verifique a conexão e tente novamente.');
    } finally {
      setIsSavingRenewal(false);
    }
  };

  // Audits logs filtered by document
  const currentDocAudits = useMemo(() => {
    if (!renewingDoc) return [];
    return audits.filter(a => a.documentoId === renewingDoc.id);
  }, [renewingDoc, audits]);

  const documentSummary = useMemo(() => {
    const total = filteredDocs.length;
    const validos = filteredDocs.filter(d => d.statusDocumento === 'Válido').length;
    const atencao = filteredDocs.filter(d => d.statusDocumento === 'Atenção').length;
    const criticos = filteredDocs.filter(d => d.statusDocumento === 'Crítico').length;
    const vencidos = filteredDocs.filter(d => d.statusDocumento === 'Vencido').length;
    const anexados = filteredDocs.filter(d => Boolean(d.arquivoAnexo)).length;

    return {
      total,
      validos,
      atencao,
      criticos,
      vencidos,
      anexados,
      pendencias: vencidos + criticos,
      taxaComAnexo: total > 0 ? Math.round((anexados / total) * 100) : 0,
    };
  }, [filteredDocs]);

  const getStatusBadgeClasses = (status: StatusDocumento, isNa: boolean) => {
    if (isNa) return 'bg-slate-100 text-slate-500 border-slate-200';
    if (status === 'Válido') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Atenção') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'Crítico') return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getStatusRowClasses = (status: StatusDocumento, isNa: boolean) => {
    if (isNa) return 'border-l-slate-300 opacity-60';
    if (status === 'Válido') return 'border-l-emerald-500 hover:bg-emerald-50/30';
    if (status === 'Atenção') return 'border-l-amber-500 hover:bg-amber-50/30';
    if (status === 'Crítico') return 'border-l-orange-500 hover:bg-orange-50/30';
    return 'border-l-rose-500 hover:bg-rose-50/30';
  };

  return (
    <div className="space-y-6">
      {/* Hero corporativo */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200">
                <FileText className="h-3.5 w-3.5" />
                Gestão documental da frota
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Vencimentos e Documentação Operacional
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
                Controle de CIV, CIPP, Tacógrafo, Inmetro e laudos obrigatórios com rastreabilidade, anexos e histórico de auditoria.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Documentos</span>
              <strong className="mt-1 block text-3xl font-extrabold text-white">{documentSummary.total}</strong>
              <span className="text-xs text-slate-300">no filtro atual</span>
            </div>

            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 backdrop-blur">
              <span className="text-[11px] font-bold uppercase tracking-widest text-rose-100">Pendências</span>
              <strong className="mt-1 block text-3xl font-extrabold text-white">{documentSummary.pendencias}</strong>
              <span className="text-xs text-rose-100">vencidos + críticos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Válidos</span>
              <strong className="mt-2 block text-3xl font-extrabold text-slate-950">{documentSummary.validos}</strong>
              <p className="mt-1 text-xs font-medium text-slate-500">documentos conformes</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Atenção</span>
              <strong className="mt-2 block text-3xl font-extrabold text-slate-950">{documentSummary.atencao}</strong>
              <p className="mt-1 text-xs font-medium text-slate-500">vencem em 31 a 60 dias</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600 ring-1 ring-amber-100">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Críticos / Vencidos</span>
              <strong className="mt-2 block text-3xl font-extrabold text-slate-950">{documentSummary.pendencias}</strong>
              <p className="mt-1 text-xs font-medium text-slate-500">exigem prioridade operacional</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-600 ring-1 ring-rose-100">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Com anexo</span>
              <strong className="mt-2 block text-3xl font-extrabold text-slate-950">{documentSummary.taxaComAnexo}%</strong>
              <p className="mt-1 text-xs font-medium text-slate-500">{documentSummary.anexados} arquivos registrados</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 ring-1 ring-blue-100">
              <Upload className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Advanced filters */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-900">
              <Search className="h-4 w-4 text-blue-600" />
              Filtros de documentos
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Localize por placa, tipo documental, status calculado e empresa da frota.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            <ClipboardList className="h-3.5 w-3.5" />
            {filteredDocs.length} resultado(s)
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <input
              id="search-doc-plate-input"
              type="text"
              placeholder="Filtrar por placa. Ex.: ABC1D23"
              value={plateQuery}
              onChange={(e) => setPlateQuery(e.target.value.toUpperCase())}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 font-mono text-sm font-bold text-slate-800 shadow-inner outline-none transition-all placeholder:font-sans placeholder:font-medium focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          </div>

          <div>
            <select
              id="filter-doc-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos tipos documentais</option>
              <option value="INMETRO">INMETRO</option>
              <option value="TACÓGRAFO">TACÓGRAFO</option>
              <option value="CIV">CIV</option>
              <option value="CIPP">CIPP</option>
              <option value="LAUDO QUINTA RODA">LAUDO QUINTA RODA</option>
              <option value="LAUDO DE BOTTOM">LAUDO DE BOTTOM</option>
              <option value="LAUDO MANGOTE">LAUDO MANGOTE</option>
            </select>
          </div>

          <div>
            <select
              id="filter-doc-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os status</option>
              <option value="Válido">Válido (&gt; 60 dias)</option>
              <option value="Atenção">Atenção (31-60 dias)</option>
              <option value="Crítico">Crítico (1-30 dias)</option>
              <option value="Vencido">Vencido</option>
            </select>
          </div>

          {!selectedEmpresaGlobal && (
            <div>
              <select
                id="filter-doc-company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Todas empresas da frota</option>
                {EMPRESAS_PADRAO.filter((empresa) => canAccessEmpresa(currentUser, empresa.id)).map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>{obterNomeEmpresa(empresa.id, EMPRESAS_PADRAO)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main documents table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-900">
              <FileText className="h-4 w-4 text-blue-600" />
              Documentos exigíveis
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Painel de vencimentos aplicáveis às placas ativas e autorizadas para o usuário.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">Válidos: {documentSummary.validos}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-100">Atenção: {documentSummary.atencao}</span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700 ring-1 ring-rose-100">Vencidos: {documentSummary.vencidos}</span>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <Search className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold italic">Nenhum documento encontrado para os filtros e placa informados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left font-sans text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-200">
                  <th className="p-4">Placa / Base</th>
                  <th className="p-4">Empresa</th>
                  <th className="p-4">Documento</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4 text-center">Status calculado</th>
                  <th className="p-4">Comprovante</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => {
                  const isExp = doc.statusDocumento === 'Vencido';
                  const isCrit = doc.statusDocumento === 'Crítico';
                  const isAtt = doc.statusDocumento === 'Atenção';
                  const isNa = !doc.aplicavel;

                  return (
                    <tr
                      key={doc.id}
                      className={`group border-l-4 bg-white transition-all ${getStatusRowClasses(doc.statusDocumento, isNa)}`}
                    >
                      <td className="p-4 font-bold">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-extrabold text-slate-900 shadow-xs group-hover:border-blue-300">
                            {doc.placa}
                          </span>
                          {getVehicleBaseLabel(getDocVehicle(doc)) && (
                            <span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-blue-700 shadow-xs">
                              {getVehicleBaseLabel(getDocVehicle(doc))}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 select-none">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                          {formatarNomeEmpresaId(doc.empresaId)}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-extrabold text-slate-800 shadow-xs">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          {doc.tipoDocumento}
                        </span>
                      </td>

                      <td className="p-4 font-medium text-slate-600">
                        {isNa ? (
                          <span className="font-sans font-light text-slate-400">-</span>
                        ) : doc.dataVencimento ? (
                          <div className="flex items-center gap-2">
                            <Calendar className={`h-4 w-4 shrink-0 ${isExp ? 'text-rose-500' : isCrit ? 'text-orange-500' : isAtt ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span className={isExp ? 'font-extrabold text-rose-600' : isCrit ? 'font-bold text-orange-600' : isAtt ? 'font-semibold text-amber-600' : 'text-slate-700'}>
                              {formatarDataBR(doc.dataVencimento)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold italic text-rose-500">Sem data cadastrada</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-extrabold shadow-xs ${getStatusBadgeClasses(doc.statusDocumento, isNa)}`}>
                          {doc.statusDocumento}
                        </span>
                      </td>

                      <td className="p-4">
                        {isNa ? (
                          <span className="font-light text-slate-400">-</span>
                        ) : doc.arquivoAnexo ? (
                          <a
                            href={doc.arquivoAnexoConteudo || '#'}
                            download={doc.arquivoAnexo}
                            onClick={(e) => {
                              if (!doc.arquivoAnexoConteudo) {
                                e.preventDefault();
                                alert('Este é um anexo legado ou simulado e não possui conteúdo para download.');
                              }
                            }}
                            className="inline-flex max-w-[180px] items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                            title="Clique para baixar o comprovante"
                          >
                            <Upload className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate font-mono underline decoration-blue-400">{doc.arquivoAnexo}</span>
                          </a>
                        ) : (
                          <span className="flex items-center gap-1 text-xs italic text-slate-400 select-none">
                            <Info className="h-3.5 w-3.5 text-slate-350" />
                            Sem comprovante
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {canWrite && (
                          <button
                            onClick={() => openRenewModal(doc)}
                            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:scale-95"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Renovar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RENEWING / EDITING DOCUMENT MODAL */}
      {renewingDoc && (
        <div
          id="renew-document-modal"
          className="fixed left-0 right-0 bottom-0 top-[68px] bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSavingRenewal) {
              setRenewingDoc(null);
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[calc(100dvh-100px)] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal header */}
            <div className="shrink-0 bg-slate-950 px-6 pt-6 relative z-20 shadow-[0_1px_0_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5 sm:flex">
                    <img src="/grupo-potencial.png" alt="Grupo Potencial" className="max-h-7 max-w-7 object-contain" />
                  </div>
                  <span className="px-3 py-1 bg-white/10 font-mono font-bold border border-white/15 text-white rounded-lg shadow-xs">
                    {renewingDoc.placa}
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Atualização / Renovação de {renewingDoc.tipoDocumento}
                  </h3>
                </div>
                <button 
                  onClick={() => setRenewingDoc(null)}
                  disabled={isSavingRenewal}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-rose-500 hover:text-white hover:border-rose-400 cursor-pointer shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Fechar renovação"
                  aria-label="Fechar renovação"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex gap-2 items-center">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleRenewalSubmit} className="flex-1 overflow-y-auto bg-slate-50 px-6 pb-6 pt-5 space-y-4 text-xs font-sans">

                {inputApplicable ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                        Cópia Digitalizada (Anexo PDF/Foto) *
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                      <div 
                        onDragOver={handleDragOver}
                        onDrop={handleFileDropReal}
                        onClick={handleZoneClick}
                        className="w-full bg-white border-2 border-dashed border-blue-200 hover:border-blue-500 p-5 rounded-2xl cursor-pointer text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 hover:text-slate-700 transition-colors shadow-sm py-6"
                      >
                        <Upload className="h-6 w-6 text-blue-600 shrink-0 animate-pulse" />
                        <span className="font-semibold text-slate-700">
                          {isReadingFile ? (
                            'Lendo arquivo anexado...'
                          ) : inputAttachedFileName ? (
                            <span>Arquivo selecionado: <strong className="text-blue-600 font-mono font-bold">{inputAttachedFileName}</strong></span>
                          ) : (
                            'Arraste e solte o documento ou clique para selecionar (PDF, PNG, JPG)'
                          )}
                        </span>
                        <span className="text-xs text-slate-400">Tamanho máximo permitido: 750 KB. O documento será salvo no banco de dados Neon.</span>
                      </div>

                      {inputAttachedFileName && (
                        <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                              Anexo atual
                            </span>
                            <span className="block truncate font-mono text-xs font-semibold text-slate-700">
                              {inputAttachedFileName}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAttachedFile();
                            }}
                            disabled={isSavingRenewal || isReadingFile}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            title="Excluir anexo deste documento"
                          >
                            <X className="h-3 w-3" />
                            Excluir anexo
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                          Data de Emissão *
                        </label>
                        <input
                          id="ren-emission-input"
                          type="date"
                          required
                          className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-semibold"
                          value={inputEmission}
                          onChange={(e) => setInputEmission(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                          Data de Vencimento *
                        </label>
                        <input
                          id="ren-expiration-input"
                          type="date"
                          required
                          className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-semibold"
                          value={inputExpiration}
                          onChange={(e) => setInputExpiration(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-center font-medium italic select-none">
                    Esse documento está configurado como isento/não aplicável. Vencimentos e pendências não serão cobrados para esta placa.
                  </div>
                )}

                {/* Justification - REQUIRED if dates are manual edited (Requirement 10) */}
                <div>
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    Justificativa da Alteração / Renovação *
                    {renewingDoc.dataVencimento !== inputExpiration && (
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.2 rounded shrink-0">
                        Obrigatório (vencimento alterado)
                      </span>
                    )}
                  </label>
                  <textarea
                    id="ren-justification-textarea"
                    rows={2}
                    required={renewingDoc.dataVencimento !== inputExpiration}
                    placeholder="Detalhamento do motivo ou certidão anexada. ABC1D23 passou por vistoria..."
                    className="w-full bg-white border border-slate-250 p-2.5 text-slate-850 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs placeholder-slate-400 font-sans"
                    value={inputJustification}
                    onChange={(e) => setInputJustification(e.target.value)}
                  />
                </div>

                {/* Document specific comments */}
                <div>
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Observações Adicionais
                  </label>
                  <input
                    id="ren-obs-input"
                    type="text"
                    placeholder="Anotação de rodapé para a tela de relatórios..."
                    className="w-full bg-white border border-slate-250 px-2.5 py-2 text-slate-850 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                    value={inputObs}
                    onChange={(e) => setInputObs(e.target.value)}
                  />
                </div>

                {/* LOGS HISTORIC SUBPANEL */}
                <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-2 shadow-sm">
                  <span className="font-bold text-slate-500 uppercase tracking-widest text-xs block">
                    Histórico de Auditorias de {renewingDoc.tipoDocumento} ({renewingDoc.placa})
                  </span>

                  {currentDocAudits.length === 0 ? (
                    <span className="text-xs text-slate-450 block pl-1 italic font-medium">
                      Nenhuma alteração de auditoria realizada neste documento até o momento.
                    </span>
                  ) : (
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 font-sans">
                      {currentDocAudits.map(log => (
                        <div key={log.id} className="text-xs bg-white p-2 md:p-2.5 rounded border border-slate-150 shadow-xs">
                          <div className="flex justify-between text-slate-500 mb-0.5">
                            <span className="font-bold text-slate-700">{log.usuarioNome} ({log.tipoAcao})</span>
                            <span className="font-mono text-xs text-slate-400">{new Date(log.dataHora).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-slate-600 leading-normal pl-1.5 border-l-2 border-slate-200 font-medium">
                            De <strong className="text-slate-400 line-through">{log.valorAnterior || 'vazio'}</strong> para <strong className="text-blue-600 font-bold">{log.valorNovo}</strong>
                            <span className="block text-xs text-slate-500 italic mt-0.5 font-sans font-normal">
                              Justificativa: "{log.observacao || 'Sem obs'}"
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => setRenewingDoc(null)}
                    disabled={isSavingRenewal}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-xl cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRenewal || isReadingFile}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingRenewal ? 'Salvando...' : isReadingFile ? 'Lendo anexo...' : 'Gravar Renovação'}
                  </button>
                </div>

            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
