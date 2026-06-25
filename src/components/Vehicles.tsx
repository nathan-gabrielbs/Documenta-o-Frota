/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, Edit2, Link, Unlink, Activity, FileCheck, Info,
  AlertTriangle, Truck, Eye, CheckCircle2, XCircle, Search, 
  Trash2, X, ClipboardList, Calendar, User
} from 'lucide-react';
import { Veiculo, Documento, Usuario, TipoUnidade, StatusVeiculo } from '../types';
import { dbInLocalStorage, PREDEFINED_COMPANIES, isDocumentApplicable } from '../utils/mockdb';
import { EMPRESAS_PADRAO, obterNomeEmpresa } from '../utils/empresaUtils';

interface VehiclesProps {
  currentUser: Usuario;
  initialSearch?: string;
  selectedEmpresaGlobal: string;
}

export default function Vehicles({ currentUser, initialSearch = '', selectedEmpresaGlobal }: VehiclesProps) {
  
  // Real-time local state synced from LocalDB
  const [vehicles, setVehicles] = useState<Veiculo[]>(() => dbInLocalStorage.getVehicles());
  const [documents, setDocuments] = useState<Documento[]>(() => dbInLocalStorage.getDocuments());
  const [audits, setAudits] = useState(() => dbInLocalStorage.getAudits());
  const companyOptions = PREDEFINED_COMPANIES.length > 0 ? PREDEFINED_COMPANIES : EMPRESAS_PADRAO;

  // Search and view states
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [companyFilter, setCompanyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  // Modals / Details toggles
  const [selectedVehicle, setSelectedVehicle] = useState<Veiculo | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Veiculo | null>(null);
  const [deleteConfirmVehicle, setDeleteConfirmVehicle] = useState<Veiculo | null>(null);
  const [systemAlertMessage, setSystemAlertMessage] = useState<string | null>(null);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const savingDocumentIdRef = useRef<string | null>(null);

  // Form states for creating a new vehicle
  const [newPlate, setNewPlate] = useState('');
  const [newCompany, setNewCompany] = useState('empresa-bwt');
  const [newType, setNewType] = useState<TipoUnidade>('Cavalo');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState<number>(2024);
  const [newRenavam, setNewRenavam] = useState('');
  const [newChassi, setNewChassi] = useState('');
  const [newStatus, setNewStatus] = useState<StatusVeiculo>('ativo');
  const [newObs, setNewObs] = useState('');
  const [newArrendado, setNewArrendado] = useState(false);
  const [newEmpresaArrendadora, setNewEmpresaArrendadora] = useState('');
  const [formError, setFormError] = useState('');

  // Composition / Coupling dropdown states or refs
  const [couplingTargetId, setCouplingTargetId] = useState('');
  const [newVehicleDocumentType, setNewVehicleDocumentType] = useState('');
  const [newVehicleDocumentError, setNewVehicleDocumentError] = useState('');

  // Access control shortcuts
  const canWrite = currentUser.perfil !== 'Consulta';
  const isAdmin = currentUser.perfil === 'Administrador';

  // Synchronize state with db helper
  const reloadFromDB = () => {
    setVehicles(dbInLocalStorage.getVehicles());
    setDocuments(dbInLocalStorage.getDocuments());
    setAudits(dbInLocalStorage.getAudits());
  };

  useEffect(() => {
    window.addEventListener('mockdb-update', reloadFromDB);
    return () => window.removeEventListener('mockdb-update', reloadFromDB);
  }, []);

  // Evita duas barras de rolagem quando a ficha lateral do veículo estiver aberta.
  // Mantém apenas a rolagem interna do drawer e bloqueia o scroll da página ao fundo.
  useEffect(() => {
    if (!selectedVehicle) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedVehicle]);

  // Filter local lists
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Plate search matched
      const matchesSearch = searchQuery ? v.placa.toLowerCase().includes(searchQuery.toLowerCase()) || v.modelo.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      
      // Global and screen filters
      const effectiveCompany = selectedEmpresaGlobal || companyFilter;
      const matchesCompany = effectiveCompany ? v.empresaId === effectiveCompany : true;
      const matchesType = typeFilter ? v.tipoUnidade === typeFilter : true;
      
      return matchesSearch && matchesCompany && matchesType;
    });
  }, [vehicles, searchQuery, companyFilter, typeFilter, selectedEmpresaGlobal]);

  // Generate compliance percentage for each individual vehicle based strictly on applicable docs
  const getVehicleCompliance = (vehicleId: string) => {
    const veh = vehicles.find(v => v.id === vehicleId);
    const vehicleDocs = documents.filter(d => d.veiculoId === vehicleId || (veh && d.placa === veh.placa));
    if (vehicleDocs.length === 0) return 100;
    
    const applicableDocs = vehicleDocs.filter(d => d.aplicavel);
    if (applicableDocs.length === 0) return 100; // No requirements -> 100% compliant

    const compliantDocs = applicableDocs.filter(d => d.statusDocumento === 'Válido' || d.statusDocumento === 'Atenção');
    return Math.round((compliantDocs.length / applicableDocs.length) * 100);
  };

  // Handle vehicle creation with unique checks and validation
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const formattedPlate = newPlate.trim().toUpperCase();
    if (!formattedPlate) {
      setFormError('A placa do veículo é obrigatória.');
      return;
    }

    // Check plate format / length simplified
    if (formattedPlate.length < 7) {
      setFormError('Insira uma placa de veículo válida (no mínimo 7 caracteres).');
      return;
    }

    // Check duplicate plates
    const plateExists = vehicles.some(v => v.placa === formattedPlate);
    if (plateExists) {
      setFormError(`A placa ${formattedPlate} já está cadastrada no sistema.`);
      return;
    }

    // Prepare new vehicle object
    const createdId = `v-${Date.now()}`;
    const nowISO = new Date().toISOString();
    const newVehicle: Veiculo = {
      id: createdId,
      placa: formattedPlate,
      empresaId: newCompany,
      tipoUnidade: newType,
      modelo: newModel || 'Modelo Geral',
      ano: Number(newYear) || 2024,
      renavam: newRenavam,
      chassi: newChassi,
      status: newStatus,
      observacoes: newObs,
      arrendado: newArrendado,
      empresaArrendadora: newArrendado ? newEmpresaArrendadora.trim() : '',
      criadoPor: currentUser.nome,
      atualizadoPor: currentUser.nome,
      dataCadastro: nowISO,
      dataAtualizacao: nowISO
    };

    // Instantiate default empty documents (CIV, CIPP, INMETRO, Tacógrafo, etc.) for this plate
    const docTypes: Documento['tipoDocumento'][] = ['CIV', 'CIPP', 'INMETRO', 'TACÓGRAFO', 'LAUDO QUINTA RODA', 'LAUDO DE BOTTOM', 'LAUDO MANGOTE'];
    const newDocs: Documento[] = docTypes.map((type, index) => {
      // Intuitively set initial applicability based on Unit Type (Cavalo vs Carreta vs Porta Container etc.)
      const initialApplicable = isDocumentApplicable(newType, type);

      return {
        id: `d-new-${createdId}-${index}`,
        veiculoId: createdId,
        placa: formattedPlate,
        empresaId: newCompany,
        tipoDocumento: type,
        aplicavel: initialApplicable,
        numeroDocumento: '',
        dataEmissao: '',
        dataVencimento: '',
        statusDocumento: initialApplicable ? 'Vencido' : 'Não aplicável', // start with pending if applicable but blank
        criadoPor: currentUser.nome,
        atualizadoPor: currentUser.nome,
        dataCadastro: nowISO,
        dataAtualizacao: nowISO
      };
    });

    const activeVehicles = [...vehicles, newVehicle];
    const activeDocuments = [...documents, ...newDocs];

    // Save
    dbInLocalStorage.saveVehicles(activeVehicles);
    dbInLocalStorage.saveDocuments(activeDocuments);

    // Logger Audit Activity
    dbInLocalStorage.logAudit(
      currentUser,
      newVehicle,
      'criação',
      'veículo',
      'Inexistente',
      `Novo veículo cadastrado: Placa ${newVehicle.placa}, Tipo ${newVehicle.tipoUnidade}`,
      'Cadastro inicial concluído.'
    );

    reloadFromDB();
    setIsCreateModalOpen(false);
    
    // Reset Form fields
    setNewPlate('');
    setNewModel('');
    setNewYear(2024);
    setNewRenavam('');
    setNewChassi('');
    setNewObs('');
    setNewArrendado(false);
    setNewEmpresaArrendadora('');
  };

  // Open Edit Modal for a specific vehicle
  const openEditModal = (v: Veiculo) => {
    setEditingVehicle(v);
    setIsEditModalOpen(true);
  };

  // Save changes to current vehicle
  const handleEditVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    const original = vehicles.find(v => v.id === editingVehicle.id);
    if (!original) return;

    const updatedList = vehicles.map(v => {
      if (v.id === editingVehicle.id) {
        return {
          ...editingVehicle,
          atualizadoPor: currentUser.nome,
          dataAtualizacao: new Date().toISOString()
        };
      }
      return v;
    });

    dbInLocalStorage.saveVehicles(updatedList);

    // Audit logs for critical changes
    if (original.empresaId !== editingVehicle.empresaId) {
      dbInLocalStorage.logAudit(
        currentUser,
        editingVehicle,
        'edição',
        'empresa vinculada',
        original.empresaId,
        editingVehicle.empresaId,
        'Alteração de pertencimento corporativo.'
      );
    }
    if (original.status !== editingVehicle.status) {
      dbInLocalStorage.logAudit(
        currentUser,
        editingVehicle,
        original.status === 'inativo' ? 'edição' : 'inativação',
        'status operacional',
        original.status,
        editingVehicle.status,
        'Atualização de status do veículo.'
      );
    }
    if ((original.arrendado || false) !== (editingVehicle.arrendado || false) || (original.empresaArrendadora || '') !== (editingVehicle.empresaArrendadora || '')) {
      dbInLocalStorage.logAudit(
        currentUser,
        editingVehicle,
        'edição',
        'informação de arrendamento',
        original.arrendado ? `Arrendado de ${original.empresaArrendadora || 'empresa não informada'}` : 'Não arrendado',
        editingVehicle.arrendado ? `Arrendado de ${editingVehicle.empresaArrendadora || 'empresa não informada'}` : 'Não arrendado',
        'Atualização visual de arrendamento, sem alterar responsabilidade documental.'
      );
    }

    reloadFromDB();
    setIsEditModalOpen(false);

    // Update selected vehicle view if currently viewing
    if (selectedVehicle && selectedVehicle.id === editingVehicle.id) {
      setSelectedVehicle({
        ...editingVehicle,
        atualizadoPor: currentUser.nome,
        dataAtualizacao: new Date().toISOString()
      });
    }
  };

  // Delete/Remove vehicle + clean its documents
  const handleDeleteVehicle = async (v: Veiculo) => {
    // Clean linked references (decoupler on delete)
    const clearedVehicles = vehicles.map(item => {
      if (item.carretaVinculadaId === v.id) {
        return { ...item, carretaVinculadaId: undefined, dataAtualizacao: new Date().toISOString() };
      }
      if (item.cavaloVinculadoId === v.id) {
        return { ...item, cavaloVinculadoId: undefined, dataAtualizacao: new Date().toISOString() };
      }
      return item;
    }).filter(item => item.id !== v.id);

    // Clean documents
    const clearedDocs = documents.filter(d => d.veiculoId !== v.id && d.placa !== v.placa);

    await dbInLocalStorage.saveVehicles(clearedVehicles);
    await dbInLocalStorage.saveDocuments(clearedDocs);

    // Log in audits
    await dbInLocalStorage.logAudit(
      currentUser,
      v,
      'exclusão',
      'veículo',
      `Placa ${v.placa}`,
      'Removido',
      'Exclusão efetuada por usuário gestor/admin.'
    );

    reloadFromDB();
    setSelectedVehicle(null);
    setDeleteConfirmVehicle(null);
  };

  // Coupling Logic (Vincular Cavalo e Carreta)
  const handleCoupleUnits = (cavaloId: string, carretaId: string) => {
    if (!cavaloId || !carretaId) return;

    const cavalo = vehicles.find(v => v.id === cavaloId);
    const carreta = vehicles.find(v => v.id === carretaId);

    if (!cavalo || !carreta) return;

    // Save changes inside both objects
    const updated = vehicles.map(v => {
      if (v.id === cavaloId) {
        return { ...v, carretaVinculadaId: carretaId, dataAtualizacao: new Date().toISOString(), atualizadoPor: currentUser.nome };
      }
      if (v.id === carretaId) {
        return { ...v, cavaloVinculadoId: cavaloId, dataAtualizacao: new Date().toISOString(), atualizadoPor: currentUser.nome };
      }
      return v;
    });

    dbInLocalStorage.saveVehicles(updated);

    // Log audit events
    dbInLocalStorage.logAudit(
      currentUser,
      cavalo,
      'vinculação',
      'acoplamento de conjunto',
      'Nenhum',
      `Vinculado à carreta ${carreta.placa}`,
      'Composição rodoviária criada com sucesso.'
    );

    dbInLocalStorage.logAudit(
      currentUser,
      carreta,
      'vinculação',
      'acoplamento de conjunto',
      'Nenhum',
      `Vinculado ao cavalo ${cavalo.placa}`,
      'Composição rodoviária criada com sucesso.'
    );

    reloadFromDB();
    setCouplingTargetId('');
    
    // Refresh modal view
    setSelectedVehicle(updated.find(v => v.id === cavaloId) || null);
  };

  // Decoupling Logic (Desvincular Cavalo e Carreta)
  const handleDecoupleUnits = (vehicleId: string) => {
    const vRef = vehicles.find(v => v.id === vehicleId);
    if (!vRef) return;

    let linkedId = '';
    if (vRef.tipoUnidade === 'Cavalo') {
      linkedId = vRef.carretaVinculadaId || '';
    } else {
      linkedId = vRef.cavaloVinculadoId || '';
    }

    if (!linkedId) return;
    const linkedRef = vehicles.find(v => v.id === linkedId);

    const updated = vehicles.map(v => {
      if (v.id === vehicleId) {
        return { 
          ...v, 
          carretaVinculadaId: undefined, 
          cavaloVinculadoId: undefined, 
          dataAtualizacao: new Date().toISOString(), 
          atualizadoPor: currentUser.nome 
        };
      }
      if (v.id === linkedId) {
        return { 
          ...v, 
          carretaVinculadaId: undefined, 
          cavaloVinculadoId: undefined, 
          dataAtualizacao: new Date().toISOString(), 
          atualizadoPor: currentUser.nome 
        };
      }
      return v;
    });

    dbInLocalStorage.saveVehicles(updated);

    dbInLocalStorage.logAudit(
      currentUser,
      vRef,
      'desvinculação',
      'acoplamento de conjunto',
      linkedRef ? linkedRef.placa : 'Antigo link',
      'Desvinculado',
      'Desacoplamento manual do conjunto.'
    );

    if (linkedRef) {
      dbInLocalStorage.logAudit(
        currentUser,
        linkedRef,
        'desvinculação',
        'acoplamento de conjunto',
        vRef.placa,
        'Desvinculado',
        'Desacoplamento manual do conjunto.'
      );
    }

    reloadFromDB();
    setSelectedVehicle(updated.find(v => v.id === vehicleId) || null);
  };

  // Change individual Document applicability (Obrigatoriedade por veículo)
  const toggleDocApplicability = async (doc: Documento, newVal: boolean) => {
    if (savingDocumentIdRef.current) return;

    const nextStatus = newVal ? 'Vencido' : 'Não aplicável'; // reset to simple state if checked back
    const updatedDoc: Documento = {
      ...doc,
      aplicavel: newVal,
      statusDocumento: nextStatus,
      dataAtualizacao: new Date().toISOString(),
      atualizadoPor: currentUser.nome
    };
    const previousDocuments = documents;

    savingDocumentIdRef.current = doc.id;
    setSavingDocumentId(doc.id);
    setDocuments(documents.map(d => d.id === doc.id ? updatedDoc : d));

    try {
      await dbInLocalStorage.updateDocument(updatedDoc);

      // Track in audits
      const parentVehic = vehicles.find(v => v.id === doc.veiculoId);
      if (parentVehic) {
        try {
          await dbInLocalStorage.logAudit(
            currentUser,
            parentVehic,
            'edição',
            `aplicabilidade do documento ${doc.tipoDocumento}`,
            doc.aplicavel ? 'Aplicável' : 'Não aplicável',
            newVal ? 'Aplicável' : 'Não aplicável',
            'Modificação das exigências regulamentares da placa.',
            doc.id,
            doc.tipoDocumento
          );
        } catch (auditError) {
          console.error('Erro ao registrar auditoria de aplicabilidade:', auditError);
        }
      }

      reloadFromDB();
    } catch (error) {
      console.error('Erro ao alterar aplicabilidade do documento:', error);
      setDocuments(previousDocuments);
      setSystemAlertMessage('Não foi possível salvar a alteração deste documento agora. Os dados foram restaurados e serão recarregados do banco. Tente novamente em instantes.');
      await dbInLocalStorage.refreshAll();
      reloadFromDB();
    } finally {
      savingDocumentIdRef.current = null;
      setSavingDocumentId(null);
    }
  };

  const handleAddVehicleDocumentType = async () => {
    if (!selectedVehicle) return;

    const trimmedType = newVehicleDocumentType.trim().toUpperCase();
    setNewVehicleDocumentError('');

    if (!trimmedType) {
      setNewVehicleDocumentError('Informe o nome do tipo de documento.');
      return;
    }

    const typeAlreadyExists = selectedVehicleDocs.some(doc => doc.tipoDocumento.toUpperCase() === trimmedType);
    if (typeAlreadyExists) {
      setNewVehicleDocumentError('Este tipo de documento já existe para esta placa.');
      return;
    }

    const nowISO = new Date().toISOString();
    const newDoc: Documento = {
      id: `d-custom-${selectedVehicle.id}-${Date.now()}`,
      veiculoId: selectedVehicle.id,
      placa: selectedVehicle.placa,
      empresaId: selectedVehicle.empresaId,
      tipoDocumento: trimmedType,
      aplicavel: true,
      numeroDocumento: '',
      dataEmissao: '',
      dataVencimento: '',
      statusDocumento: 'Vencido',
      criadoPor: currentUser.nome,
      atualizadoPor: currentUser.nome,
      dataCadastro: nowISO,
      dataAtualizacao: nowISO
    };

    await dbInLocalStorage.saveDocuments([...documents, newDoc]);
    await dbInLocalStorage.logAudit(
      currentUser,
      selectedVehicle,
      'criação',
      `tipo de documento ${trimmedType}`,
      'Inexistente',
      'Obrigatório',
      'Novo tipo de documento obrigatório incluído para a placa.',
      newDoc.id,
      trimmedType
    );

    setNewVehicleDocumentType('');
    reloadFromDB();
  };

  // Lists of available counterparts to couple
  const availableCouplings = useMemo(() => {
    if (!selectedVehicle) return [];
    if (selectedVehicle.tipoUnidade === 'Cavalo') {
      // Return Carretas currently uncoupled of the same company
      return vehicles.filter(v => (v.tipoUnidade === 'Carreta' || v.tipoUnidade === 'Porta Container') && !v.cavaloVinculadoId && v.empresaId === selectedVehicle.empresaId);
    } else if (selectedVehicle.tipoUnidade === 'Carreta' || selectedVehicle.tipoUnidade === 'Porta Container') {
      // Return Cavalos currently uncoupled of the same company
      return vehicles.filter(v => v.tipoUnidade === 'Cavalo' && !v.carretaVinculadaId && v.empresaId === selectedVehicle.empresaId);
    }
    return [];
  }, [vehicles, selectedVehicle]);

  // Selected vehicle properties
  const selectedVehicleDocs = useMemo(() => {
    if (!selectedVehicle) return [];
    return documents.filter(d => d.veiculoId === selectedVehicle.id || d.placa === selectedVehicle.placa);
  }, [selectedVehicle, documents]);

  // Check the linked counterpart in Cavalo + Carreta composition
  const selectedLinkedVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    const twinId = selectedVehicle.tipoUnidade === 'Cavalo' 
      ? selectedVehicle.carretaVinculadaId 
      : selectedVehicle.cavaloVinculadoId;
    if (!twinId) return null;
    return vehicles.find(v => v.id === twinId) || null;
  }, [selectedVehicle, vehicles]);

  // Combined documents of Cavalo + Carreta set
  const ensembleDocs = useMemo(() => {
    if (!selectedVehicle) return [];
    const directDocs = documents.filter(d => d.veiculoId === selectedVehicle.id || d.placa === selectedVehicle.placa);
    if (!selectedLinkedVehicle) return directDocs;
    const twinDocs = documents.filter(d => d.veiculoId === selectedLinkedVehicle.id || d.placa === selectedLinkedVehicle.placa);
    return [...directDocs, ...twinDocs];
  }, [selectedVehicle, selectedLinkedVehicle, documents]);

  // Audits logs compiled for this plate
  const selectedVehicleAudits = useMemo(() => {
    if (!selectedVehicle) return [];
    return audits.filter(a => a.placa === selectedVehicle.placa);
  }, [selectedVehicle, audits]);

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <Truck className="text-blue-600 h-6 w-6" />
            Cadastro de Veículos da Frota
          </h1>
          <p className="text-sm text-slate-500 font-sans">
            Cadastre cavalos mecânicos, carretas acopladas e autotrucks com rastreamento de empresa.
          </p>
        </div>

        {canWrite && (
          <button
            id="register-vehicle-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 py-2 px-4.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-sm select-none transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Novo Veículo
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 shadow-sm">
        <div className="flex-1 relative">
          <input
            id="search-vehicle-input"
            type="text"
            placeholder="Pesquisar por placa ou modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 px-3 py-2 pl-9 text-sm text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm"
          />
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
        </div>

        {!selectedEmpresaGlobal && (
          <div className="w-full md:w-48">
            <select
              id="filter-company-select"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 px-3 py-2 text-sm text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm font-medium cursor-pointer"
            >
              <option value="">Todas empresas</option>
              {companyOptions.map(c => (
                <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companyOptions)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="w-full md:w-48">
          <select
            id="filter-type-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 px-3 py-2 text-sm text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm font-medium cursor-pointer"
          >
            <option value="">Todos tipos de unidade</option>
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
      </div>

      {/* Main Vehicles Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {filteredVehicles.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Nenhum veículo encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold tracking-wider text-xs uppercase">
                  <th className="p-4">Placa / Empresa</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Modelo / Ano</th>
                  <th className="p-4 text-center">Conformidade Individual</th>
                  <th className="p-4">Composição Conjunto</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((veh) => {
                  const compValue = getVehicleCompliance(veh.id);
                  const isHorse = veh.tipoUnidade === 'Cavalo';
                  const isTrailer = veh.tipoUnidade === 'Carreta' || veh.tipoUnidade === 'Porta Container';
                  
                  // counterpart plate lookup
                  const linkedRefObj = veh.carretaVinculadaId 
                    ? vehicles.find(v => v.id === veh.carretaVinculadaId)
                    : veh.cavaloVinculadoId 
                      ? vehicles.find(v => v.id === veh.cavaloVinculadoId)
                      : null;

                  return (
                    <tr 
                      key={veh.id} 
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedVehicle(veh)}
                    >
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-1 border border-slate-200 rounded group-hover:border-blue-300 transition-colors shadow-xs">
                            {veh.placa}
                          </span>
                          <span className="text-xs text-slate-500 block pt-1 font-medium select-none">
                            {obterNomeEmpresa(veh.empresaId, companyOptions)}
                          </span>
                          {veh.arrendado && (
                            <span className="text-[11px] text-indigo-600 block font-semibold select-none">
                              Arrendado{veh.empresaArrendadora ? ` de ${veh.empresaArrendadora}` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-semibold text-slate-700">
                          {veh.tipoUnidade}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5 text-slate-600">
                          <p className="font-medium truncate max-w-[170px] text-slate-900">{veh.modelo}</p>
                          <p className="text-xs text-slate-400">Ano: {veh.ano}</p>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-200 shadow-xs">
                          <span className={`w-2 h-2 rounded-full ${
                            compValue >= 90 ? 'bg-emerald-500' :
                            compValue >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          <span className="font-bold text-slate-700 text-sm">{compValue}%</span>
                        </div>
                      </td>

                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        {linkedRefObj ? (
                          <div className="flex items-center gap-2">
                            <span className="p-1 px-1.5 text-xs font-mono border border-slate-200 bg-slate-50 rounded text-slate-700 font-bold shadow-xs">
                              {linkedRefObj.placa}
                            </span>
                            <button
                              onClick={() => handleDecoupleUnits(veh.id)}
                              title="Desvincular composição"
                              className="p-1 bg-slate-100 text-slate-500 hover:text-rose-600 rounded cursor-pointer hover:bg-slate-200 transition-colors"
                            >
                              <Unlink className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-sans select-none">
                            Individual / Sem Vínculo
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tracking-wider lowercase border select-none ${
                          veh.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          veh.status === 'manutenção' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          veh.status === 'bloqueado' ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-xs' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {veh.status}
                        </span>
                      </td>

                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedVehicle(veh)}
                            title="Ver Ficha Detalhada"
                            className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/60 rounded-md cursor-pointer transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {canWrite && (
                            <button
                              onClick={() => openEditModal(veh)}
                              title="Editar Veículo"
                              className="p-1.5 bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200/60 rounded-md cursor-pointer transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmVehicle(veh)}
                              title="Excluir Ativo"
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/60 rounded-md cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Vehicle */}
      {isCreateModalOpen && (
        <div id="create-vehicle-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold uppercase text-blue-600 tracking-wider">
                Novo Cadastro de Veículo
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateVehicle} className="space-y-4 text-sm font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Placa do Veículo *
                  </label>
                  <input
                    id="new-plate-input"
                    type="text"
                    required
                    placeholder="ABC1D23"
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all font-mono text-xs"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Empresa da Frota *
                  </label>
                  <select
                    id="new-company-select"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    {companyOptions.map(c => (
                      <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companyOptions)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Tipo de Unidade *
                  </label>
                  <select
                    id="new-type-select"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as TipoUnidade)}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    <option value="Cavalo">Cavalo (Mecânico)</option>
                    <option value="Carreta">Carreta (Reboque)</option>
                    <option value="Porta Container">Porta Container</option>
                    <option value="Truck">Truck</option>
                    <option value="Toco">Toco</option>
                    <option value="Bitruck">Bitruck</option>
                    <option value="Baú">Baú</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Status Operacional *
                  </label>
                  <select
                    id="new-status-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as StatusVeiculo)}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="manutenção">Em Manutenção</option>
                    <option value="vendido">Vendido</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Modelo
                  </label>
                  <input
                    id="new-model-input"
                    type="text"
                    placeholder="Volvo FH 540"
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Ano
                  </label>
                  <input
                    id="new-year-input"
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Renavam (11 dígitos)
                  </label>
                  <input
                    id="new-renavam-input"
                    type="text"
                    maxLength={11}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                    value={newRenavam}
                    onChange={(e) => setNewRenavam(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Chassi (opcional)
                  </label>
                  <input
                    id="new-chassi-input"
                    type="text"
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                    value={newChassi}
                    onChange={(e) => setNewChassi(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                  Observações Internas
                </label>
                <textarea
                  id="new-obs-textarea"
                  rows={2}
                  className="w-full bg-white border border-slate-250 p-2.5 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                  <input
                    id="new-arrendado-checkbox"
                    type="checkbox"
                    checked={newArrendado}
                    onChange={(e) => {
                      setNewArrendado(e.target.checked);
                      if (!e.target.checked) setNewEmpresaArrendadora('');
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Unidade arrendada
                </label>
                {newArrendado && (
                  <div>
                    <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                      Empresa arrendadora
                    </label>
                    <input
                      id="new-empresa-arrendadora-input"
                      type="text"
                      placeholder="Ex.: BWT"
                      className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                      value={newEmpresaArrendadora}
                      onChange={(e) => setNewEmpresaArrendadora(e.target.value.toUpperCase())}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Informação apenas visual; a responsabilidade documental permanece na Empresa da Frota.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4 font-semibold">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: Edit Vehicle */}
      {isEditModalOpen && editingVehicle && (
        <div id="edit-vehicle-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold uppercase text-amber-600 tracking-wider">
                Editar Cadastro: {editingVehicle.placa}
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditVehicleSubmit} className="space-y-4 text-sm font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Empresa Vinculada (Audita Alteração)
                  </label>
                  <select
                    id="edit-company-select"
                    value={editingVehicle.empresaId}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, empresaId: e.target.value })}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    {companyOptions.map(c => (
                      <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companyOptions)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Status Operacional
                  </label>
                  <select
                    id="edit-status-select"
                    value={editingVehicle.status}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, status: e.target.value as StatusVeiculo })}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="manutenção">Em Manutenção</option>
                    <option value="vendido">Vendido</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Modelo
                  </label>
                  <input
                    id="edit-model-input"
                    type="text"
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                    value={editingVehicle.modelo}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, modelo: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Ano
                  </label>
                  <input
                    id="edit-year-input"
                    type="number"
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                    value={editingVehicle.ano}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, ano: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Renavam
                  </label>
                  <input
                    id="edit-renavam-input"
                    type="text"
                    maxLength={11}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                    value={editingVehicle.renavam}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, renavam: e.target.value.replace(/\D/g, '') })}
                  />
                </div>

                <div>
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Chassi
                  </label>
                  <input
                    id="edit-chassi-input"
                    type="text"
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                    value={editingVehicle.chassi || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, chassi: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                  Observações de Frota
                </label>
                <textarea
                  id="edit-obs-textarea"
                  rows={2}
                  className="w-full bg-white border border-slate-250 p-2.5 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                  value={editingVehicle.observacoes || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, observacoes: e.target.value })}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer">
                  <input
                    id="edit-arrendado-checkbox"
                    type="checkbox"
                    checked={editingVehicle.arrendado || false}
                    onChange={(e) => setEditingVehicle({
                      ...editingVehicle,
                      arrendado: e.target.checked,
                      empresaArrendadora: e.target.checked ? (editingVehicle.empresaArrendadora || '') : ''
                    })}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  Unidade arrendada
                </label>
                {editingVehicle.arrendado && (
                  <div>
                    <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                      Empresa arrendadora
                    </label>
                    <input
                      id="edit-empresa-arrendadora-input"
                      type="text"
                      placeholder="Ex.: BWT"
                      className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs"
                      value={editingVehicle.empresaArrendadora || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, empresaArrendadora: e.target.value.toUpperCase() })}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Informação apenas visual; filtros e documentos continuam pela Empresa Vinculada.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4 font-semibold">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MASTER VEHICLE DRAWER / DETAILS SIDE MODAL */}
      {selectedVehicle && (
        <div
          id="vehicle-drawer-overlay"
          className="fixed left-0 right-0 bottom-0 top-[68px] bg-slate-900/40 backdrop-blur-xs z-[9999] flex justify-end overflow-hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedVehicle(null);
            }
          }}
        >
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-white border-l border-slate-200 h-[calc(100dvh-68px)] shadow-2xl font-sans flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 sticky top-0 bg-white px-6 pt-5 relative z-20 shadow-[0_1px_0_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
                <div className="flex items-center gap-4">
                  <span className="p-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-850 text-base shadow-xs">
                    {selectedVehicle.placa}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Ficha do Veículo ({selectedVehicle.tipoUnidade})
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      Divisão operacional: <strong className="text-blue-600 font-semibold">{obterNomeEmpresa(selectedVehicle.empresaId, companyOptions)}</strong>
                      {selectedVehicle.arrendado && (
                        <span className="block text-indigo-600 font-semibold">
                          Unidade arrendada{selectedVehicle.empresaArrendadora ? ` de ${selectedVehicle.empresaArrendadora}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedVehicle(null)}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer shadow-xs transition-colors"
                    title="Fechar ficha do veículo"
                    aria-label="Fechar ficha do veículo"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Master layout grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Column 1: Core Specifications */}
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4 text-xs">
                  <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs pb-1 border-b border-slate-200">
                    Propriedades Técnicas
                  </h4>

                  <div className="space-y-2.5 text-slate-650">
                    <div>
                      <span className="text-xs text-slate-450 block font-medium">Modelo / Descritivo</span>
                      <strong className="text-slate-900 text-xs">{selectedVehicle.modelo}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-slate-450 block font-medium">Ano Fabricação</span>
                        <strong className="text-slate-800">{selectedVehicle.ano}</strong>
                      </div>
                      <div>
                        <span className="text-xs text-slate-450 block font-medium">Status Operação</span>
                        <strong className="text-blue-600 capitalize">{selectedVehicle.status}</strong>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-450 block font-medium">Renavam</span>
                      <strong className="font-mono text-slate-800 tracking-wider text-sm">{selectedVehicle.renavam || 'Não registrado'}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-450 block font-medium">Identificação Chassi</span>
                      <strong className="font-mono text-slate-600 text-xs block truncate">{selectedVehicle.chassi || 'Não informado'}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-450 block font-medium">Registro de Entrada</span>
                      <span className="text-xs text-slate-500 font-medium">{new Date(selectedVehicle.dataCadastro).toLocaleDateString('pt-BR')} por {selectedVehicle.criadoPor}</span>
                    </div>
                    {selectedVehicle.observacoes && (
                      <div className="pt-2 border-t border-slate-200 text-sm text-slate-500 leading-relaxed italic bg-white/40 p-1.5 rounded border border-slate-100">
                        "{selectedVehicle.observacoes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2 & 3: Composition coupling panel (Visão Cavalo + Carreta) */}
                <div className="md:col-span-2 space-y-5">
                  
                  {/* COUPLING BLOCK (Requirement 4) */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs">
                        Composição do Conjunto Rodoviário
                      </h4>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Vínculo Cavalo + Reboque
                      </div>
                    </div>

                    {selectedLinkedVehicle ? (
                      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-blue-100 border border-blue-200 text-blue-600 rounded-lg">
                            <Truck className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs text-blue-650 block font-bold uppercase tracking-tight">Conjunto Ativo</span>
                            <span className="font-mono font-bold text-slate-900 text-xs">{selectedLinkedVehicle.placa}</span>
                            <span className="text-xs text-slate-500 block">{selectedLinkedVehicle.tipoUnidade} • {selectedLinkedVehicle.modelo}</span>
                          </div>
                        </div>

                        {canWrite && (
                          <button
                            onClick={() => handleDecoupleUnits(selectedVehicle.id)}
                            className="p-2 px-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100/70 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all active:scale-[0.98]"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                            Desvincular
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
                        <div className="text-sm text-slate-500 leading-normal">
                          Este veículo está operando de forma <strong className="text-slate-800">individual</strong> e independente no sistema. Vincule com uma licença da mesma empresa corporativa.
                        </div>

                        {canWrite && (selectedVehicle.tipoUnidade === 'Cavalo' || selectedVehicle.tipoUnidade === 'Carreta' || selectedVehicle.tipoUnidade === 'Porta Container') && (
                          <div className="flex gap-2 text-xs">
                            <select
                                id="couple-target-select"
                                value={couplingTargetId}
                                onChange={(e) => setCouplingTargetId(e.target.value)}
                                className="bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all flex-1 text-xs font-semibold cursor-pointer"
                            >
                              <option value="">-- Selecione {selectedVehicle.tipoUnidade === 'Cavalo' ? 'a Carreta/Porta Container' : 'o Cavalo'} Disponível --</option>
                              {availableCouplings.map(item => (
                                <option key={item.id} value={item.id}>
                                  [{item.placa}] {item.modelo}
                                </option>
                              ))}
                            </select>

                            <button
                              disabled={!couplingTargetId}
                              onClick={() => handleCoupleUnits(
                                selectedVehicle.tipoUnidade === 'Cavalo' ? selectedVehicle.id : couplingTargetId,
                                selectedVehicle.tipoUnidade === 'Cavalo' ? couplingTargetId : selectedVehicle.id
                              )}
                              className="px-4 py-1.5 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer transition-all shrink-0 font-sans shadow-xs"
                            >
                              Acoplar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* DOCUMENTS APPLICABILITY CONFIG (Requirement 4) */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs">
                        Controle de Aplicabilidade Regulamentar
                      </h4>
                      <span className="text-xs text-slate-450 italic font-medium">
                        Selecione as obrigatoriedades desta placa
                      </span>
                    </div>

                    {canWrite && (
                      <div className="bg-white border border-dashed border-blue-200 rounded-lg p-3 space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={newVehicleDocumentType}
                            onChange={(e) => {
                              setNewVehicleDocumentType(e.target.value);
                              setNewVehicleDocumentError('');
                            }}
                            placeholder="Novo tipo de documento para esta placa"
                            className="flex-1 bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all shadow-sm uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleAddVehicleDocumentType}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-xs text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Inserir tipo
                          </button>
                        </div>
                        {newVehicleDocumentError && (
                          <p className="text-xs text-rose-600 font-semibold">{newVehicleDocumentError}</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {selectedVehicleDocs.map((doc) => {
                        const isDocVencido = doc.statusDocumento === 'Vencido';
                        const isDocCritico = doc.statusDocumento === 'Crítico';
                        const isSavingThisDocument = savingDocumentId === doc.id;
                        const isSavingAnotherDocument = savingDocumentId !== null && !isSavingThisDocument;
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg hover:bg-slate-50/60 transition-colors shadow-xs">
                            <div className="flex items-center gap-2">
                              <input
                                id={`apply-checkbox-${doc.id}`}
                                type="checkbox"
                                disabled={!canWrite || savingDocumentId !== null}
                                checked={doc.aplicavel}
                                onChange={(e) => toggleDocApplicability(doc, e.target.checked)}
                                className={`w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 ${savingDocumentId ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              />
                              <div>
                                <label htmlFor={`apply-checkbox-${doc.id}`} className="font-bold text-slate-800 text-xs block cursor-pointer">
                                  {doc.tipoDocumento}
                                </label>
                                <span className="text-xs text-slate-450 leading-none block font-medium">
                                  {isSavingThisDocument ? 'Salvando alteração...' : isSavingAnotherDocument ? 'Aguarde o salvamento em andamento' : doc.aplicavel ? 'Documentação obrigatória' : 'Não exigido'}
                                </span>
                              </div>
                            </div>

                            {/* Badge showing calculated status */}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              doc.statusDocumento === 'Não aplicável' ? 'bg-slate-100 border-slate-200 text-slate-450' :
                              doc.statusDocumento === 'Válido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              doc.statusDocumento === 'Atenção' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                            }`}>
                              {doc.statusDocumento}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>

              {/* SECTION: ENSEMBLE COMPLIANCE OVERVIEW (If Twin Coupled) */}
              {selectedLinkedVehicle && (
                <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs pb-1.5 border-b border-slate-200">
                    Visão Geral do Conjunto Completo ({selectedVehicle.placa} + {selectedLinkedVehicle.placa})
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 text-xs">
                      <p className="text-slate-600 font-medium">Total de Documentos Coletivos: <strong className="text-slate-900">{ensembleDocs.length}</strong></p>
                      <p className="text-slate-600 font-medium">Documentos Aplicáveis Ativos: <strong className="text-slate-900">{ensembleDocs.filter(d => d.aplicavel).length}</strong></p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 font-medium">Pendências ativas no conjunto:</p>
                      
                      {ensembleDocs.filter(d => d.aplicavel && (d.statusDocumento === 'Vencido' || d.statusDocumento === 'Crítico')).length === 0 ? (
                        <div className="p-2 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Todo o conjunto está regulamentar e liberado para rodagem!
                        </div>
                      ) : (
                        <div className="p-2 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200 flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                          Existem pendências impeditivas de tráfego no conjunto cavalo+reboque.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AUDIT LOG FOR THIS LICENSE PLATE */}
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs pb-2 border-b border-slate-200 mb-3 flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" />
                  Logs de Alterações e Auditoria da Placa {selectedVehicle.placa}
                </h4>

                {selectedVehicleAudits.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic font-medium">
                    Nenhuma alteração registrada em auditoria para esta placa até o momento.
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                    {selectedVehicleAudits.map((log) => {
                      const logDateStr = new Date(log.dataHora).toLocaleDateString('pt-BR');
                      const logTimeStr = new Date(log.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={log.id} className="text-xs p-3 bg-white rounded-lg border border-slate-205 flex flex-col md:flex-row md:items-start justify-between gap-2.5 shadow-xs">
                          <div className="space-y-1">
                            {/* Action badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded border ${
                                log.tipoAcao === 'criação' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                log.tipoAcao === 'renovação' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                log.tipoAcao === 'exclusão' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {log.tipoAcao}
                              </span>
                              <span className="font-bold text-slate-800">
                                {log.campoAlterado}
                              </span>
                            </div>

                            <p className="text-sm text-slate-600 font-sans font-medium">
                              De <strong className="text-slate-400 line-through">{log.valorAnterior || 'vazio'}</strong> para <strong className="text-blue-600 font-bold">{log.valorNovo}</strong>
                            </p>

                            {log.observacao && (
                              <p className="text-sm text-slate-500 italic pl-2 border-l-2 border-slate-200">
                                Justificativa: "{log.observacao}"
                              </p>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 shrink-0 text-right">
                            <span className="flex items-center justify-end gap-1 font-bold text-slate-600">
                              <User className="h-3 w-3 shrink-0" />
                              {log.usuarioNome}
                            </span>
                            <span className="block mt-0.5 font-mono text-slate-400">
                              {logDateStr} às {logTimeStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmVehicle && (
        <div id="delete-vehicle-confirm-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 font-sans text-xs"
          >
            <div className="flex items-center gap-4 border-b border-slate-100 pb-3 mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold uppercase text-rose-600 tracking-wider">
                Excluir veículo permanentemente?
              </h3>
            </div>
            
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Tem certeza que deseja excluir permanentemente o veículo <strong className="text-slate-900 font-bold">{deleteConfirmVehicle.placa}</strong>? Isso removerá também todos os documentos associados. Esta ação não poderá ser desfeita.
            </p>

            <div className="flex justify-end gap-4 pt-2">
              <button
                onClick={() => setDeleteConfirmVehicle(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-200 shadow-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteVehicle(deleteConfirmVehicle)}
                className="px-4 py-2 bg-rose-650 hover:bg-rose-700 text-white font-bold rounded-xl border border-rose-700 shadow-xs cursor-pointer transition-colors"
              >
                Confirmar Exclusão
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom System Alert Modal */}
      {systemAlertMessage && (
        <div id="system-alert-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 font-sans text-xs text-center"
          >
            <div className="mx-auto w-12 h-12 flex items-center justify-center text-amber-500 bg-amber-50 rounded-full mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">Atenção</h4>
            <p className="text-slate-600 mb-5 leading-relaxed">{systemAlertMessage}</p>
            <button
              onClick={() => setSystemAlertMessage(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </motion.div>
        </div>
      )}

    </div>
  );
}
