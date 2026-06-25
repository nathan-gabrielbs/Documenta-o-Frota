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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access rights check
  const canWrite = currentUser.perfil !== 'Consulta';

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

  // Perform advanced filters across the list
  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      // Exclude documents that are not applicable
      if (!d.aplicavel) return false;

      // Plate search matched
      const matchesPlate = plateQuery ? d.placa.toLowerCase().includes(plateQuery.toLowerCase()) : true;
      
      // Selectors matched
      const matchesType = typeFilter ? d.tipoDocumento === typeFilter : true;
      const matchesStatus = statusFilter ? d.statusDocumento === statusFilter : true;
      
      const effectiveCompany = selectedEmpresaGlobal || companyFilter;
      const matchesCompany = effectiveCompany ? d.empresaId === effectiveCompany : true;

      return matchesPlate && matchesType && matchesStatus && matchesCompany;
    });
  }, [documents, plateQuery, typeFilter, statusFilter, companyFilter, selectedEmpresaGlobal]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 750 * 1024) {
        setFormError('O arquivo selecionado excede o limite máximo permitido de 750 KB. Por favor, reduza o tamanho do arquivo ou use um arquivo comprimido.');
        setInputAttachedFileName('');
        setInputAttachedFileConteudo('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setFormError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputAttachedFileName(file.name);
        setInputAttachedFileConteudo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileDropReal = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 750 * 1024) {
        setFormError('O arquivo selecionado excede o limite máximo permitido de 750 KB. Por favor, reduza o tamanho do arquivo ou use um arquivo comprimido.');
        setInputAttachedFileName('');
        setInputAttachedFileConteudo('');
        return;
      }
      setFormError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputAttachedFileName(file.name);
        setInputAttachedFileConteudo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  // Save the modified document + write logs with justification checked
  const handleRenewalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingDoc) return;

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
          arquivoAnexo: inputApplicable ? inputAttachedFileName : undefined,
          arquivoAnexoConteudo: inputApplicable ? inputAttachedFileConteudo : undefined,
          statusDocumento: statusResult,
          observacoes: inputObs,
          atualizadoPor: currentUser.nome,
          dataAtualizacao: new Date().toISOString()
        };
      }
      return d;
    });

    dbInLocalStorage.saveDocuments(updatedDocs);

    // Log in audits (Requirement 3: Audit manual changes)
    dbInLocalStorage.logAudit(
      currentUser,
      parentVeh,
      isDateChanged ? 'renovação' : 'edição',
      `vencimento do documento ${renewingDoc.tipoDocumento}`,
      renewingDoc.dataVencimento ? formatarDataBR(renewingDoc.dataVencimento) : 'vazio',
      inputApplicable ? formatarDataBR(inputExpiration) : 'Não aplicável',
      inputJustification || 'Atualização cadastral padrão de documento.',
      renewingDoc.id,
      renewingDoc.tipoDocumento
    );

    reloadFromDB();
    setRenewingDoc(null);
  };

  // Audits logs filtered by document
  const currentDocAudits = useMemo(() => {
    if (!renewingDoc) return [];
    return audits.filter(a => a.documentoId === renewingDoc.id);
  }, [renewingDoc, audits]);

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <FileText className="text-blue-600 h-6 w-6" />
            Vencimentos e Documentação Operacional
          </h1>
          <p className="text-sm text-slate-500 font-sans">
            Acompanhe o andamento de CIV, CIPP, Tacógrafo, Inmetro e Laudos. Insira renovações com justificativa.
          </p>
        </div>
      </div>

      {/* Advanced filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 shadow-sm">
        
        {/* Search by plate */}
        <div className="relative">
          <input
            id="search-doc-plate-input"
            type="text"
            placeholder="Filtrar por Placa (ex: ABC1D23)..."
            value={plateQuery}
            onChange={(e) => setPlateQuery(e.target.value.toUpperCase())}
            className="w-full bg-white border border-slate-200 px-3 py-2 pl-9 text-xs text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all font-mono shadow-sm"
          />
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* Filter by Document Type */}
        <div>
          <select
            id="filter-doc-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm font-medium cursor-pointer"
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

        {/* Filter by calculated status */}
        <div>
          <select
            id="filter-doc-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm font-medium cursor-pointer"
          >
            <option value="">Todos os Status</option>
            <option value="Válido">Válido ( &gt; 60 dias )</option>
            <option value="Atenção">Atenção ( 31-60 dias )</option>
            <option value="Crítico">Crítico ( 1-30 dias )</option>
            <option value="Vencido">Vencido</option>
          </select>
        </div>

        {/* Filter by corporate company */}
        {!selectedEmpresaGlobal && (
          <div>
            <select
              id="filter-doc-company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm font-medium cursor-pointer"
            >
              <option value="">Todas empresas da frota</option>
              <option value="BWT">BWT</option>
              <option value="POTENCIAL COMBUSTÍVEIS">POTENCIAL COMBUSTÍVEIS</option>
              <option value="POTENCIAL AGRO">POTENCIAL AGRO</option>
              <option value="BWI">BWI</option>
              <option value="JETA">JETA</option>
            </select>
          </div>
        )}
      </div>

      {/* Main documents table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {filteredDocs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs italic">
            Nenhum documento encontrado para os filtros e placa informados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold tracking-wider text-[10px] uppercase">
                  <th className="p-4">Placa de Ativo</th>
                  <th className="p-4">Empresa</th>
                  <th className="p-4">Tipo Documento</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4 text-center">Calculado</th>
                  <th className="p-4">Arquivo Anexo</th>
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
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isNa ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="p-4 font-bold">
                        <span className="font-mono bg-slate-100 border border-slate-200 text-slate-800 rounded px-1.5 py-0.5 shadow-xs">
                          {doc.placa}
                        </span>
                      </td>

                      <td className="p-4 text-slate-500 font-medium select-none">
                        {doc.empresaId}
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px] shadow-xs">
                          {doc.tipoDocumento}
                        </span>
                      </td>

                      <td className="p-4 text-slate-600 font-medium">
                        {isNa ? (
                          <span className="text-slate-400 font-sans font-light">-</span>
                        ) : doc.dataVencimento ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className={isExp ? 'text-rose-600 font-bold' : isCrit ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                              {formatarDataBR(doc.dataVencimento)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-rose-500 font-bold italic">Sem data cadastrada</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border select-none ${
                          isNa ? 'bg-slate-100 text-slate-450 border-slate-200' :
                          doc.statusDocumento === 'Válido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isAtt ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          isCrit ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {doc.statusDocumento}
                        </span>
                      </td>

                      <td className="p-4">
                        {isNa ? (
                          <span className="text-slate-400 font-light">-</span>
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
                            className="text-slate-650 font-semibold flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer" 
                            title="Clique para baixar o comprovante"
                          >
                            <Upload className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[130px] font-mono text-[10px] text-blue-600 decoration-blue-500 underline">
                              {doc.arquivoAnexo}
                            </span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic flex items-center gap-1 select-none">
                            <Info className="h-3 w-3 text-slate-350" />
                            Sem comprovante
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {canWrite && (
                          <button
                            onClick={() => openRenewModal(doc)}
                            className="p-1 px-3 bg-slate-50 hover:bg-blue-50 text-[10px] border border-slate-200 text-slate-600 hover:text-blue-600 font-bold rounded cursor-pointer flex items-center gap-1 ml-auto transition-all duration-150 active:scale-95 shadow-xs"
                          >
                            <Edit2 className="h-2.5 w-2.5" />
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
        <div id="renew-document-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col justify-between"
          >
            {/* Modal content */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 font-mono font-bold border border-slate-200 text-blue-600 rounded shadow-xs">
                    {renewingDoc.placa}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Atualização / Renovação de {renewingDoc.tipoDocumento}
                  </h3>
                </div>
                <button 
                  onClick={() => setRenewingDoc(null)}
                  className="text-slate-400 hover:text-slate-650 cursor-pointer p-1"
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

              <form onSubmit={handleRenewalSubmit} className="space-y-4 text-xs font-sans">
                
                {/* Switch block for applicability toggle */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 text-xs block">Obrigatoriedade Regulamentar</span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Desmarque se este veículo for isento da exigência do {renewingDoc.tipoDocumento} nesta operação.
                    </span>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={inputApplicable}
                      onChange={(e) => setInputApplicable(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-205 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white border border-slate-200"></div>
                  </label>
                </div>

                {inputApplicable ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-[10px]">
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
                        className="w-full bg-white border border-dashed border-slate-250 hover:border-blue-500/55 p-4 rounded-lg cursor-pointer text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 hover:text-slate-700 transition-colors shadow-xs py-5"
                      >
                        <Upload className="h-5 w-5 text-blue-500 shrink-0 animate-pulse" />
                        <span className="font-semibold text-slate-700">
                          {inputAttachedFileName ? (
                            <span>Arquivo selecionado: <strong className="text-blue-600 font-mono font-bold">{inputAttachedFileName}</strong></span>
                          ) : (
                            'Arraste e solte o documento ou clique para selecionar (PDF, PNG, JPG)'
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">Tamanho máximo permitido: 750 KB (limite do banco de dados Firestore). O documento será salvo no banco de dados.</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-[10px]">
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
                        <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-[10px]">
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
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    Justificativa da Alteração / Renovação *
                    {renewingDoc.dataVencimento !== inputExpiration && (
                      <span className="text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.2 rounded shrink-0">
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
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-[10px]">
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
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-2">
                  <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px] block">
                    Histórico de Auditorias de {renewingDoc.tipoDocumento} ({renewingDoc.placa})
                  </span>

                  {currentDocAudits.length === 0 ? (
                    <span className="text-[10px] text-slate-450 block pl-1 italic font-medium">
                      Nenhuma alteração de auditoria realizada neste documento até o momento.
                    </span>
                  ) : (
                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 font-sans">
                      {currentDocAudits.map(log => (
                        <div key={log.id} className="text-[10px] bg-white p-2 md:p-2.5 rounded border border-slate-150 shadow-xs">
                          <div className="flex justify-between text-slate-500 mb-0.5">
                            <span className="font-bold text-slate-700">{log.usuarioNome} ({log.tipoAcao})</span>
                            <span className="font-mono text-[9px] text-slate-400">{new Date(log.dataHora).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <p className="text-slate-600 leading-normal pl-1.5 border-l-2 border-slate-200 font-medium">
                            De <strong className="text-slate-400 line-through">{log.valorAnterior || 'vazio'}</strong> para <strong className="text-blue-600 font-bold">{log.valorNovo}</strong>
                            <span className="block text-[9px] text-slate-500 italic mt-0.5 font-sans font-normal">
                              Justificativa: "{log.observacao || 'Sem obs'}"
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => setRenewingDoc(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer shadow-xs transition-colors"
                  >
                    Gravar Renovação
                  </button>
                </div>

              </form>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
