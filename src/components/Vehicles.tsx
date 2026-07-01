/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Link, Unlink, Activity, FileCheck, Info,
  AlertTriangle, Truck, Eye, CheckCircle2, XCircle, Search,
  Trash2, X, ClipboardList, Calendar, User, Download, Upload
} from 'lucide-react';
import { Veiculo, Documento, Usuario, TipoUnidade, StatusVeiculo } from '../types';
import { dbInLocalStorage, PREDEFINED_COMPANIES, isDocumentApplicable } from '../utils/mockdb';
import { EMPRESAS_PADRAO, obterNomeEmpresa } from '../utils/empresaUtils';
import { canAccessEmpresa, getEffectiveEmpresaFilter } from '../utils/accessControl';
import { BASES_POTENCIAL_COMBUSTIVEIS, getVehicleBaseLabel, isPotencialCombustiveisVehicle } from '../utils/vehicleBaseUtils';

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
  const [crlvVehicle, setCrlvVehicle] = useState<Veiculo | null>(null);
  const [crlvError, setCrlvError] = useState('');
  const [isCrlvUploading, setIsCrlvUploading] = useState(false);
  const [systemAlertMessage, setSystemAlertMessage] = useState<string | null>(null);
  const [savingDocumentIds, setSavingDocumentIds] = useState<Set<string>>(() => new Set());
  const savingDocumentIdsRef = useRef<Set<string>>(new Set());

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
  const [newBaseOperacional, setNewBaseOperacional] = useState('');
  const [formError, setFormError] = useState('');

  // Composition / Coupling dropdown states or refs
  const [newVehicleDocumentType, setNewVehicleDocumentType] = useState('');
  const [newVehicleDocumentError, setNewVehicleDocumentError] = useState('');

  // Access control shortcuts
  const canWrite = currentUser.perfil !== 'Consulta';
  const isAdmin = currentUser.perfil === 'Administrador';
  const COUPLING_UNIT_TYPES: TipoUnidade[] = ['Cavalo', 'Carreta', 'Porta Container'];
  const TRAILER_UNIT_TYPES: TipoUnidade[] = ['Carreta', 'Porta Container'];

  const isCouplingUnit = (tipoUnidade: TipoUnidade) => COUPLING_UNIT_TYPES.includes(tipoUnidade);
  const isTrailerUnit = (tipoUnidade: TipoUnidade) => TRAILER_UNIT_TYPES.includes(tipoUnidade);
  const getHorseTrailerIds = (horse: Veiculo) => [horse.carretaVinculadaId, horse.carreta2VinculadaId].filter(Boolean) as string[];
  const getFirstAvailableTrailerSlot = (horse: Veiculo): 'carretaVinculadaId' | 'carreta2VinculadaId' | null => {
    if (!horse.carretaVinculadaId) return 'carretaVinculadaId';
    if (!horse.carreta2VinculadaId) return 'carreta2VinculadaId';
    return null;
  };

  const vehicleHasCrlv = (vehicle: Veiculo) => Boolean(vehicle.crlvAnexoConteudo);

  const downloadVehicleCrlv = (vehicle: Veiculo) => {
    if (!vehicle.crlvAnexoConteudo) {
      setSystemAlertMessage(`A placa ${vehicle.placa} ainda não possui CRLV anexado.`);
      return;
    }

    const link = document.createElement('a');
    link.href = vehicle.crlvAnexoConteudo;
    link.download = vehicle.crlvAnexoNome || `CRLV-${vehicle.placa}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveVehicleCrlv = async (vehicle: Veiculo, file: File) => {
    setCrlvError('');
    setIsCrlvUploading(true);

    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const nowISO = new Date().toISOString();

      const updatedVehicle: Veiculo = {
        ...vehicle,
        crlvAnexoNome: file.name,
        crlvAnexoConteudo: fileContent,
        atualizadoPor: currentUser.nome,
        dataAtualizacao: nowISO
      };

      const updatedVehicles = vehicles.map(v =>
        v.id === vehicle.id ? updatedVehicle : v
      );

      await dbInLocalStorage.saveVehicles(updatedVehicles);

      await dbInLocalStorage.logAudit(
        currentUser,
        updatedVehicle,
        'edição',
        'CRLV anexado',
        vehicle.crlvAnexoNome || 'Sem anexo',
        file.name,
        'Anexo de CRLV atualizado para a placa.'
      );

      setVehicles(updatedVehicles);
      setCrlvVehicle(updatedVehicle);

      if (selectedVehicle?.id === vehicle.id) {
        setSelectedVehicle(updatedVehicle);
      }
    } finally {
      setIsCrlvUploading(false);
    }
  };

  const removeVehicleCrlv = async (vehicle: Veiculo) => {
    setCrlvError('');

    const nowISO = new Date().toISOString();

    const updatedVehicle: Veiculo = {
      ...vehicle,
      crlvAnexoNome: undefined,
      crlvAnexoConteudo: undefined,
      atualizadoPor: currentUser.nome,
      dataAtualizacao: nowISO
    };

    const updatedVehicles = vehicles.map(v =>
      v.id === vehicle.id ? updatedVehicle : v
    );

    // Fecha o modal imediatamente, sem esperar o banco
    setCrlvVehicle(null);

    // Atualiza a tela imediatamente
    setVehicles(updatedVehicles);

    if (selectedVehicle?.id === vehicle.id) {
      setSelectedVehicle(updatedVehicle);
    }

    try {
      await dbInLocalStorage.saveVehicles(updatedVehicles);

      await dbInLocalStorage.logAudit(
        currentUser,
        updatedVehicle,
        'edição',
        'CRLV anexado',
        vehicle.crlvAnexoNome || 'Anexo existente',
        'Removido',
        'Anexo de CRLV removido da placa.'
      );
    } catch (error) {
      console.error('Erro ao remover CRLV:', error);

      setSystemAlertMessage(
        'O anexo foi removido da tela, mas houve erro ao salvar no banco. Atualize a página e confira se a alteração foi gravada.'
      );
    }
  };

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
      if (!canAccessEmpresa(currentUser, v.empresaId)) return false;
      const effectiveCompany = getEffectiveEmpresaFilter(currentUser, selectedEmpresaGlobal, companyFilter);
      const matchesCompany = effectiveCompany ? v.empresaId === effectiveCompany : true;
      const matchesType = typeFilter ? v.tipoUnidade === typeFilter : true;

      return matchesSearch && matchesCompany && matchesType;
    });
  }, [vehicles, searchQuery, companyFilter, typeFilter, selectedEmpresaGlobal, currentUser]);

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
      baseOperacional: newCompany === 'empresa-potencial-combustiveis' ? newBaseOperacional : '',
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
    setNewBaseOperacional('');
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
    if ((original.baseOperacional || '') !== (editingVehicle.baseOperacional || '')) {
      dbInLocalStorage.logAudit(
        currentUser,
        editingVehicle,
        'edição',
        'base operacional',
        original.baseOperacional || 'Base não definida',
        editingVehicle.baseOperacional || 'Base não definida',
        'Atualização da base da placa POTENCIAL COMBUSTÍVEIS.'
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

  // Coupling Logic (Vincular Cavalo e até duas Carretas/Porta Container)
  const handleCoupleUnits = (cavaloId: string, carretaId: string, requestedSlot?: 'carreta1' | 'carreta2') => {
    if (!cavaloId || !carretaId) return;

    const cavalo = vehicles.find(v => v.id === cavaloId);
    const carreta = vehicles.find(v => v.id === carretaId);

    if (!cavalo || !carreta) return;
    if (cavalo.tipoUnidade !== 'Cavalo' || !isTrailerUnit(carreta.tipoUnidade)) return;
    if (cavalo.empresaId !== carreta.empresaId || carreta.cavaloVinculadoId) return;

    const slotField = requestedSlot === 'carreta2'
      ? (!cavalo.carreta2VinculadaId ? 'carreta2VinculadaId' : null)
      : requestedSlot === 'carreta1'
        ? (!cavalo.carretaVinculadaId ? 'carretaVinculadaId' : null)
        : getFirstAvailableTrailerSlot(cavalo);

    if (!slotField) return;

    // Save changes inside both objects
    const updated = vehicles.map(v => {
      if (v.id === cavaloId) {
        return { ...v, [slotField]: carretaId, dataAtualizacao: new Date().toISOString(), atualizadoPor: currentUser.nome };
      }
      if (v.id === carretaId) {
        return { ...v, cavaloVinculadoId: cavaloId, dataAtualizacao: new Date().toISOString(), atualizadoPor: currentUser.nome };
      }
      return v;
    });

    dbInLocalStorage.saveVehicles(updated);

    const trailerLabel = slotField === 'carreta2VinculadaId' ? 'CARRETA 2' : 'CARRETA 1';

    // Log audit events
    dbInLocalStorage.logAudit(
      currentUser,
      cavalo,
      'vinculação',
      'acoplamento de conjunto',
      'Nenhum',
      `Vinculado à ${trailerLabel} ${carreta.placa}`,
      'Composição rodoviária criada com sucesso.'
    );

    dbInLocalStorage.logAudit(
      currentUser,
      carreta,
      'vinculação',
      'acoplamento de conjunto',
      'Nenhum',
      `Vinculado ao cavalo ${cavalo.placa} como ${trailerLabel}`,
      'Composição rodoviária criada com sucesso.'
    );

    reloadFromDB();
    // Refresh modal view
    setSelectedVehicle(updated.find(v => v.id === selectedVehicle?.id) || null);
  };

  // Decoupling Logic (Desvincular Cavalo e Carreta)
  const handleDecoupleUnits = (vehicleId: string, specificLinkedId?: string) => {
    const vRef = vehicles.find(v => v.id === vehicleId);
    if (!vRef) return;

    let linkedId = '';
    if (vRef.tipoUnidade === 'Cavalo') {
      linkedId = specificLinkedId || vRef.carretaVinculadaId || vRef.carreta2VinculadaId || '';
    } else {
      linkedId = vRef.cavaloVinculadoId || '';
    }

    if (!linkedId) return;
    const linkedRef = vehicles.find(v => v.id === linkedId);

    const updated = vehicles.map(v => {
      if (v.id === vehicleId) {
        return {
          ...v,
          carretaVinculadaId: v.id === vehicleId && v.carretaVinculadaId !== linkedId ? v.carretaVinculadaId : undefined,
          carreta2VinculadaId: v.id === vehicleId && v.carreta2VinculadaId !== linkedId ? v.carreta2VinculadaId : undefined,
          cavaloVinculadoId: undefined,
          dataAtualizacao: new Date().toISOString(),
          atualizadoPor: currentUser.nome
        };
      }
      if (v.id === linkedId) {
        return {
          ...v,
          carretaVinculadaId: undefined,
          carreta2VinculadaId: undefined,
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
    // Bloqueia apenas o próprio documento enquanto ele salva.
    // Os demais checkboxes continuam livres para operações em sequência.
    if (savingDocumentIdsRef.current.has(doc.id)) return;

    const nextStatus = newVal ? 'Vencido' : 'Não aplicável'; // reset to simple state if checked back
    const previousDoc = documents.find(d => d.id === doc.id) || doc;
    const updatedDoc: Documento = {
      ...previousDoc,
      aplicavel: newVal,
      statusDocumento: nextStatus,
      dataAtualizacao: new Date().toISOString(),
      atualizadoPor: currentUser.nome
    };

    savingDocumentIdsRef.current.add(doc.id);
    setSavingDocumentIds(new Set(savingDocumentIdsRef.current));

    // Atualização otimista: a tela muda na hora, sem esperar o Neon responder.
    setDocuments(prevDocs => prevDocs.map(d => d.id === doc.id ? updatedDoc : d));

    try {
      await dbInLocalStorage.updateDocument(updatedDoc);

      // Track in audits sem travar a liberação do checkbox.
      const parentVehic = vehicles.find(v => v.id === doc.veiculoId || v.placa === doc.placa);
      if (parentVehic) {
        void dbInLocalStorage.logAudit(
          currentUser,
          parentVehic,
          'edição',
          `aplicabilidade do documento ${doc.tipoDocumento}`,
          previousDoc.aplicavel ? 'Aplicável' : 'Não aplicável',
          newVal ? 'Aplicável' : 'Não aplicável',
          'Modificação das exigências regulamentares da placa.',
          doc.id,
          doc.tipoDocumento
        ).catch((auditError) => {
          console.error('Erro ao registrar auditoria de aplicabilidade:', auditError);
        });
      }

      // Não chama reloadFromDB aqui para não atrasar a sequência de cliques
      // e para não sobrescrever outras alterações otimistas ainda em andamento.
    } catch (error) {
      console.error('Erro ao alterar aplicabilidade do documento:', error);
      setDocuments(prevDocs => prevDocs.map(d => d.id === doc.id ? previousDoc : d));
      setSystemAlertMessage('Não foi possível salvar a alteração deste documento agora. A alteração deste item foi revertida. Tente novamente em instantes.');
    } finally {
      savingDocumentIdsRef.current.delete(doc.id);
      setSavingDocumentIds(new Set(savingDocumentIdsRef.current));
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
      if (!getFirstAvailableTrailerSlot(selectedVehicle)) return [];
      // Return Carretas/Porta Container currently uncoupled of the same company
      return vehicles.filter(v => canAccessEmpresa(currentUser, v.empresaId) && isTrailerUnit(v.tipoUnidade) && !v.cavaloVinculadoId && v.empresaId === selectedVehicle.empresaId);
    } else if (isTrailerUnit(selectedVehicle.tipoUnidade)) {
      // Return Cavalos with at least one free trailer slot of the same company
      return vehicles.filter(v => canAccessEmpresa(currentUser, v.empresaId) && v.tipoUnidade === 'Cavalo' && Boolean(getFirstAvailableTrailerSlot(v)) && v.empresaId === selectedVehicle.empresaId);
    }
    return [];
  }, [vehicles, selectedVehicle]);

  // Selected vehicle properties
  const selectedVehicleDocs = useMemo(() => {
    if (!selectedVehicle) return [];
    return documents.filter(d => d.veiculoId === selectedVehicle.id || d.placa === selectedVehicle.placa);
  }, [selectedVehicle, documents]);

  // Check linked counterparts in Cavalo + Carreta 1 + Carreta 2 composition
  const selectedLinkedVehicles = useMemo(() => {
    if (!selectedVehicle) return [];
    const linkedIds = selectedVehicle.tipoUnidade === 'Cavalo'
      ? getHorseTrailerIds(selectedVehicle)
      : selectedVehicle.cavaloVinculadoId ? [selectedVehicle.cavaloVinculadoId] : [];
    return linkedIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean) as Veiculo[];
  }, [selectedVehicle, vehicles]);

  // Combined documents of Cavalo + Carreta 1 + Carreta 2 set
  const ensembleDocs = useMemo(() => {
    if (!selectedVehicle) return [];
    const directDocs = documents.filter(d => d.veiculoId === selectedVehicle.id || d.placa === selectedVehicle.placa);
    if (selectedLinkedVehicles.length === 0) return directDocs;
    const twinDocs = selectedLinkedVehicles.flatMap(linkedVehicle => documents.filter(d => d.veiculoId === linkedVehicle.id || d.placa === linkedVehicle.placa));
    return [...directDocs, ...twinDocs];
  }, [selectedVehicle, selectedLinkedVehicles, documents]);

  const renderAutoCouplingControls = () => {
    if (!selectedVehicle || !canWrite || !isCouplingUnit(selectedVehicle.tipoUnidade) || availableCouplings.length === 0) return null;

    if (selectedVehicle.tipoUnidade === 'Cavalo') {
      const trailerSlots: Array<{
        slot: 'carreta1' | 'carreta2';
        label: string;
        selectLabel: string;
        occupiedLabel: string;
        occupied: boolean;
      }> = [
          {
            slot: 'carreta1',
            label: 'CARRETA 1',
            selectLabel: 'Selecionar CARRETA 1',
            occupiedLabel: 'Carreta 1 selecionada',
            occupied: Boolean(selectedVehicle.carretaVinculadaId)
          },
          {
            slot: 'carreta2',
            label: 'CARRETA 2',
            selectLabel: 'Selecionar CARRETA 2',
            occupiedLabel: 'Carreta 2 selecionada',
            occupied: Boolean(selectedVehicle.carreta2VinculadaId)
          }
        ];

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {trailerSlots.map(({ slot, selectLabel, occupiedLabel, occupied }) => (
            <label
              key={slot}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${occupied
                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border-blue-200 text-slate-800 hover:border-blue-400 hover:bg-blue-50 cursor-pointer shadow-xs'
                }`}
            >
              <Truck className={`h-4 w-4 shrink-0 ${occupied ? 'text-slate-400' : 'text-blue-600'}`} />

              <select
                id={`couple-${slot}-select`}
                value=""
                disabled={occupied}
                onChange={(e) => {
                  const carretaId = e.target.value;
                  if (!carretaId) return;
                  handleCoupleUnits(selectedVehicle.id, carretaId, slot);
                }}
                className="w-full bg-transparent text-xs font-bold uppercase tracking-wide outline-none cursor-pointer disabled:cursor-not-allowed"
              >
                <option value="">
                  {occupied ? occupiedLabel : selectLabel}
                </option>

                {availableCouplings.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.placa}] {item.modelo}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
    }

    return (
      <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 hover:border-blue-400 hover:bg-blue-50 cursor-pointer shadow-xs transition-all">
        <Truck className="h-4 w-4 shrink-0 text-blue-600" />
        <select
          id="couple-horse-select"
          value=""
          onChange={(e) => {
            const cavaloId = e.target.value;
            if (!cavaloId) return;
            handleCoupleUnits(cavaloId, selectedVehicle.id);
          }}
          className="w-full bg-transparent text-xs font-bold uppercase tracking-wide outline-none cursor-pointer"
        >
          <option value="">Selecionar CAVALO disponível</option>
          {availableCouplings.map(item => (
            <option key={item.id} value={item.id}>
              [{item.placa}] {item.modelo}
            </option>
          ))}
        </select>
      </label>
    );
  };

  // Audits logs compiled for this plate
  const openCrlvModal = (vehicle: Veiculo) => {
    setCrlvError('');
    setCrlvVehicle(vehicle);
  };

  const selectedVehicleAudits = useMemo(() => {
    if (!selectedVehicle) return [];
    return audits.filter(a => a.placa === selectedVehicle.placa);
  }, [selectedVehicle, audits]);

  const vehicleOverviewMetrics = useMemo(() => {
    const total = filteredVehicles.length;
    const ativos = filteredVehicles.filter(v => v.status === 'ativo').length;
    const comCrlv = filteredVehicles.filter(vehicleHasCrlv).length;
    const conjuntos = filteredVehicles.filter(v =>
      Boolean(v.carretaVinculadaId || v.carreta2VinculadaId || v.cavaloVinculadoId)
    ).length;
    const complianceValues = filteredVehicles.map(v => getVehicleCompliance(v.id));
    const mediaConformidade = total > 0
      ? Math.round(complianceValues.reduce((sum, value) => sum + value, 0) / total)
      : 100;

    return {
      total,
      ativos,
      comCrlv,
      conjuntos,
      mediaConformidade,
    };
  }, [filteredVehicles, vehicles, documents]);

  return (
    <div className="space-y-6">

      {/* Corporate Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] shadow-sm"
      >
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-600/10 blur-2xl" />
        <div className="absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6 p-6 lg:p-7">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue-700">
                  <Activity className="h-3.5 w-3.5" />
                  Gestão de Frota
                </span>

                <h1 className="mt-3 text-3xl lg:text-4xl font-black tracking-tight text-slate-950">
                  Cadastro de Veículos da Frota
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 font-medium">
                  Controle corporativo das unidades do Grupo Potencial com visão por empresa, base operacional, CRLV, composição cavalo/carreta e conformidade documental.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-blue-700 shadow-xs">
                {selectedEmpresaGlobal ? obterNomeEmpresa(selectedEmpresaGlobal, companyOptions) : 'Todas as empresas'}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 shadow-xs">
                Operação integrada
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 shadow-xs">
                Segurança documental
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-slate-400">
                Painel operacional
              </span>
              <p className="mt-2 text-sm text-slate-600 font-medium leading-relaxed">
                Acompanhe rapidamente a frota filtrada e acesse o cadastro de novas unidades mantendo o padrão visual do Grupo Potencial.
              </p>
            </div>

            {canWrite && (
              <button
                id="register-vehicle-btn"
                onClick={() => setIsCreateModalOpen(true)}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                Cadastrar Novo Veículo
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Corporate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Unidades no filtro</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-950">{vehicleOverviewMetrics.total}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Placas cadastradas conforme filtros atuais.</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Ativas</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-950">{vehicleOverviewMetrics.ativos}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Unidades operacionais disponíveis.</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">CRLV anexado</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
              <FileCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-950">{vehicleOverviewMetrics.comCrlv}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Veículos com documento salvo no cadastro.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Conformidade média</span>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-950">{vehicleOverviewMetrics.mediaConformidade}%</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{vehicleOverviewMetrics.conjuntos} unidades vinculadas em composição.</p>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">
              Consulta de Ativos
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Filtre por placa, modelo, empresa ou tipo de unidade.
            </p>
          </div>
          <span className="text-xs font-bold text-blue-700">
            {filteredVehicles.length} resultado(s)
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              id="search-vehicle-input"
              type="text"
              placeholder="Pesquisar por placa ou modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm font-medium text-slate-800 shadow-xs transition-all placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-blue-600" />
          </div>

          {!selectedEmpresaGlobal && (
            <div className="w-full md:w-60">
              <select
                id="filter-company-select"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 shadow-xs transition-all focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer"
              >
                <option value="">Todas empresas</option>
                {companyOptions.filter(c => canAccessEmpresa(currentUser, c.id)).map(c => (
                  <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companyOptions)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full md:w-60">
            <select
              id="filter-type-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 shadow-xs transition-all focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer"
            >
              <option value="">Todos tipos de unidade</option>
              <option value="Cavalo">Cavalo</option>
              <option value="Carreta">Carreta</option>
              <option value="Porta Container">Porta Container</option>
              <option value="Truck">Truck</option>
              <option value="Bitruck">Bitruck</option>
              <option value="Baú">Baú</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Vehicles Table */}
      <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em]">
              Relação de Veículos
            </h3>
            <p className="mt-1 text-xs font-medium text-blue-100">
              Clique em uma linha para abrir a ficha completa da unidade.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
            <Truck className="h-3.5 w-3.5" />
            {filteredVehicles.length} unidade(s)
          </span>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="py-14 text-center text-sm font-medium text-slate-400">
            Nenhum veículo encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <th className="p-4">Placa / Empresa</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Modelo / Ano</th>
                  <th className="p-4 text-center">Conformidade Individual</th>
                  <th className="p-4">Composição Conjunto</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredVehicles.map((veh) => {
                  const compValue = getVehicleCompliance(veh.id);
                  // counterpart plate lookup
                  const linkedRefObjs = veh.tipoUnidade === 'Cavalo'
                    ? getHorseTrailerIds(veh).map(id => vehicles.find(v => v.id === id)).filter(Boolean) as Veiculo[]
                    : veh.cavaloVinculadoId
                      ? vehicles.filter(v => v.id === veh.cavaloVinculadoId)
                      : [];

                  return (
                    <tr
                      key={veh.id}
                      className="group cursor-pointer transition-all hover:bg-blue-50/40"
                      onClick={() => setSelectedVehicle(veh)}
                    >
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-black text-xs tracking-wider text-blue-950 bg-blue-50 px-2.5 py-1.5 border border-blue-100 rounded-lg group-hover:border-blue-300 group-hover:bg-white transition-colors shadow-xs">
                              {veh.placa}
                            </span>
                            {getVehicleBaseLabel(veh) && (
                              <span className="px-2 py-1 rounded-lg border border-blue-200 bg-white text-blue-700 text-[11px] font-black shadow-xs" title="Base operacional">
                                {getVehicleBaseLabel(veh)}
                              </span>
                            )}
                            {vehicleHasCrlv(veh) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadVehicleCrlv(veh);
                                }}
                                className="px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-black shadow-xs cursor-pointer transition-colors"
                                title={`Baixar CRLV da placa ${veh.placa}`}
                              >
                                CRLV
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block pt-1.5 font-semibold select-none">
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
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                          {veh.tipoUnidade}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5 text-slate-600">
                          <p className="font-bold truncate max-w-[170px] text-slate-900">{veh.modelo}</p>
                          <p className="text-xs text-slate-400">Ano: {veh.ano}</p>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-xs">
                          <span className={`w-2 h-2 rounded-full ${compValue >= 90 ? 'bg-emerald-500' :
                            compValue >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                          <span className="font-black text-slate-800 text-sm">{compValue}%</span>
                        </div>
                      </td>

                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        {linkedRefObjs.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {linkedRefObjs.map((linkedRefObj) => (
                              <div key={linkedRefObj.id} className="flex items-center gap-1">
                                <span className="p-1 px-2 text-xs font-mono border border-blue-100 bg-blue-50 rounded-lg text-blue-900 font-black shadow-xs">
                                  {linkedRefObj.placa}
                                </span>
                                <button
                                  onClick={() => handleDecoupleUnits(veh.id, linkedRefObj.id)}
                                  title="Desvincular composição"
                                  className="p-1 bg-white text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 cursor-pointer hover:bg-rose-50 transition-colors"
                                >
                                  <Unlink className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-sans font-medium select-none">
                            Individual / Sem Vínculo
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tracking-wider lowercase border select-none ${veh.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
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
                            className="p-2 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {canWrite && (
                            <button
                              onClick={() => openEditModal(veh)}
                              title="Editar Veículo"
                              className="p-2 bg-white hover:bg-amber-50 text-slate-500 hover:text-amber-700 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-xs"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmVehicle(veh)}
                              title="Excluir Ativo"
                              className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-xs"
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
        <div id="create-vehicle-modal" className="fixed inset-0 bg-blue-950/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-white border border-blue-100 rounded-3xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-4">
              <h3 className="text-sm font-black uppercase text-blue-700 tracking-[0.18em]">
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
                    onChange={(e) => {
                      setNewCompany(e.target.value);
                      if (e.target.value !== 'empresa-potencial-combustiveis') setNewBaseOperacional('');
                    }}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    {companyOptions.filter(c => canAccessEmpresa(currentUser, c.id)).map(c => (
                      <option key={c.id} value={c.id}>{obterNomeEmpresa(c.id, companyOptions)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newCompany === 'empresa-potencial-combustiveis' && (
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Base POTENCIAL COMBUSTÍVEIS
                  </label>
                  <select
                    id="new-base-operacional-select"
                    value={newBaseOperacional}
                    onChange={(e) => setNewBaseOperacional(e.target.value)}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    <option value="">Selecione a base</option>
                    {BASES_POTENCIAL_COMBUSTIVEIS.map(base => (
                      <option key={base} value={base}>{base}</option>
                    ))}
                  </select>
                </div>
              )}

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
                    <option value="Cavalo">Cavalo</option>
                    <option value="Carreta">Carreta</option>
                    <option value="Porta Container">Porta Container</option>
                    <option value="Truck">Truck</option>
                    <option value="Bitruck">Bitruck</option>
                    <option value="Baú">Baú</option>
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
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl cursor-pointer transition-colors shadow-xs font-bold"
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
        <div id="edit-vehicle-modal" className="fixed inset-0 bg-blue-950/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-white border border-blue-100 rounded-3xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-4">
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
                    onChange={(e) => setEditingVehicle({
                      ...editingVehicle,
                      empresaId: e.target.value,
                      baseOperacional: e.target.value === 'empresa-potencial-combustiveis' ? (editingVehicle.baseOperacional || '') : ''
                    })}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    {companyOptions.filter(c => canAccessEmpresa(currentUser, c.id)).map(c => (
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

              {isPotencialCombustiveisVehicle(editingVehicle) && (
                <div>
                  <label className="block text-slate-505 mb-1 font-semibold uppercase tracking-wider text-xs">
                    Base POTENCIAL COMBUSTÍVEIS
                  </label>
                  <select
                    id="edit-base-operacional-select"
                    value={editingVehicle.baseOperacional || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, baseOperacional: e.target.value })}
                    className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all text-xs font-medium cursor-pointer"
                  >
                    <option value="">Selecione a base</option>
                    {BASES_POTENCIAL_COMBUSTIVEIS.map(base => (
                      <option key={base} value={base}>{base}</option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-blue-950 rounded-xl cursor-pointer transition-colors shadow-xs font-bold"
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
          className="fixed left-0 right-0 bottom-0 top-[68px] bg-blue-950/45 backdrop-blur-xs z-[9999] flex justify-end overflow-hidden"
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
            className="relative w-full max-w-4xl bg-white border-l border-blue-100 h-[calc(100dvh-68px)] shadow-2xl font-sans flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 sticky top-0 bg-gradient-to-br from-white via-white to-blue-50 px-6 pt-5 relative z-20 shadow-[0_1px_0_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between border-b border-blue-100 pb-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="p-2 py-1 bg-blue-50 border border-blue-100 rounded-lg font-mono font-black text-blue-950 text-base tracking-wider shadow-xs">
                      {selectedVehicle.placa}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadVehicleCrlv(selectedVehicle)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold shadow-xs cursor-pointer transition-colors ${vehicleHasCrlv(selectedVehicle)
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                        }`}
                      title={vehicleHasCrlv(selectedVehicle) ? 'Baixar CRLV anexado' : 'Nenhum CRLV anexado para esta placa'}
                    >
                      CRLV
                    </button>
                    {getVehicleBaseLabel(selectedVehicle) && (
                      <span className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold shadow-xs" title="Base operacional da placa">
                        {getVehicleBaseLabel(selectedVehicle)}
                      </span>
                    )}
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => openCrlvModal(selectedVehicle)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 cursor-pointer shadow-xs transition-colors"
                        title="Anexar ou remover CRLV da placa"
                        aria-label="Editar CRLV da placa"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Ficha do Veículo ({selectedVehicle.tipoUnidade})
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      Empresa: <strong className="text-blue-600 font-semibold">{obterNomeEmpresa(selectedVehicle.empresaId, companyOptions)}</strong>
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
                  {isCouplingUnit(selectedVehicle.tipoUnidade) && (
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs">
                          Composição do Conjunto
                        </h4>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Vínculo Cavalo + Carreta
                        </div>
                      </div>

                      {selectedLinkedVehicles.length > 0 ? (
                        <>
                          <div className="space-y-2">
                            {selectedLinkedVehicles.map((linkedVehicle, index) => (
                              <div key={linkedVehicle.id} className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                  <div className="p-2 bg-blue-100 border border-blue-200 text-blue-600 rounded-lg">
                                    <Truck className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <span className="text-xs text-blue-650 block font-bold uppercase tracking-tight">{selectedVehicle.tipoUnidade === 'Cavalo' ? `CARRETA ${index + 1}` : 'CAVALO ACOPLADO'}</span>
                                    <span className="font-mono font-bold text-slate-900 text-xs">{linkedVehicle.placa}</span>
                                    <span className="text-xs text-slate-500 block">{linkedVehicle.tipoUnidade} • {linkedVehicle.modelo}</span>
                                  </div>
                                </div>

                                {canWrite && (
                                  <button
                                    onClick={() => handleDecoupleUnits(selectedVehicle.id, linkedVehicle.id)}
                                    className="p-2 px-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100/70 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all active:scale-[0.98]"
                                  >
                                    <Unlink className="h-3.5 w-3.5" />
                                    Desvincular
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="pt-2">
                            {renderAutoCouplingControls()}
                          </div>
                        </>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
                          <div className="text-sm text-slate-500 leading-normal">
                            Este veículo está operando de forma <strong className="text-slate-800">individual</strong> e independente no sistema. Vincule com uma licença da mesma empresa corporativa.
                          </div>
                          {renderAutoCouplingControls()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DOCUMENTS APPLICABILITY CONFIG (Requirement 4) */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs">
                        Controle Regulamentar
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
                        const isSavingThisDocument = savingDocumentIds.has(doc.id);
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg hover:bg-slate-50/60 transition-colors shadow-xs">
                            <div className="flex items-center gap-2">
                              <input
                                id={`apply-checkbox-${doc.id}`}
                                type="checkbox"
                                disabled={!canWrite || isSavingThisDocument}
                                checked={doc.aplicavel}
                                onChange={(e) => toggleDocApplicability(doc, e.target.checked)}
                                className={`w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 ${isSavingThisDocument ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              />
                              <div>
                                <label htmlFor={`apply-checkbox-${doc.id}`} className="font-bold text-slate-800 text-xs block cursor-pointer">
                                  {doc.tipoDocumento}
                                </label>
                                <span className="text-xs text-slate-450 leading-none block font-medium">
                                  {isSavingThisDocument ? 'Salvando alteração...' : doc.aplicavel ? 'Documentação obrigatória' : 'Não exigido'}
                                </span>
                              </div>
                            </div>

                            {/* Badge showing calculated status */}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${doc.statusDocumento === 'Não aplicável' ? 'bg-slate-100 border-slate-200 text-slate-450' :
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
              {selectedLinkedVehicles.length > 0 && (
                <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-blue-600 uppercase tracking-widest text-xs pb-1.5 border-b border-slate-200">
                    Visão Geral do Conjunto Completo ({[selectedVehicle.placa, ...selectedLinkedVehicles.map(linkedVehicle => linkedVehicle.placa)].join(' + ')})
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
                  Logs de Alterações da Placa {selectedVehicle.placa}
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
                              <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded border ${log.tipoAcao === 'criação' ? 'bg-teal-50 text-teal-700 border-teal-200' :
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

      {/* CRLV Attachment Modal */}
      {crlvVehicle && (
        <div id="crlv-attachment-modal" className="fixed inset-0 bg-blue-950/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white border border-blue-100 rounded-3xl shadow-2xl p-6 font-sans text-xs"
          >
            <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-black uppercase text-blue-700 tracking-[0.18em]">
                  CRLV da placa {crlvVehicle.placa}
                </h3>
                <p className="text-slate-500 mt-1">Anexe, baixe ou remova o documento salvo no cadastro do veículo.</p>
              </div>
              <button
                onClick={() => setCrlvVehicle(null)}
                className="text-slate-400 hover:text-slate-650 cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">Documento atual</p>
                  <p className="text-slate-500 break-all">{crlvVehicle.crlvAnexoNome || 'Nenhum CRLV anexado.'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full border font-bold ${vehicleHasCrlv(crlvVehicle) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {vehicleHasCrlv(crlvVehicle) ? 'Anexado' : 'Pendente'}
                </span>
              </div>

              <label
                className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl transition-colors shadow-xs font-bold ${isCrlvUploading
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  }`}
              >
                <Upload className={`h-4 w-4 ${isCrlvUploading ? 'animate-pulse' : ''}`} />

                {isCrlvUploading ? 'Anexando documento, aguarde...' : 'Anexar/Substituir CRLV'}

                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  disabled={isCrlvUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';

                    if (!file) return;

                    try {
                      await saveVehicleCrlv(crlvVehicle, file);
                    } catch (error) {
                      console.error('Erro ao salvar CRLV:', error);
                      setCrlvError('Não foi possível salvar o CRLV. Tente novamente.');
                    }
                  }}
                />
              </label>

              {crlvError && <p className="text-rose-600 font-semibold">{crlvError}</p>}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => downloadVehicleCrlv(crlvVehicle)}
                disabled={!vehicleHasCrlv(crlvVehicle)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Baixar CRLV
              </button>
              <button
                type="button"
                onClick={() => {
                  void removeVehicleCrlv(crlvVehicle);
                }}
                disabled={!vehicleHasCrlv(crlvVehicle)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-rose-700 font-bold rounded-xl border border-rose-200 shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remover anexo
              </button>
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
            className="w-full max-w-md bg-white border border-blue-100 rounded-3xl shadow-2xl p-6 font-sans text-xs"
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
