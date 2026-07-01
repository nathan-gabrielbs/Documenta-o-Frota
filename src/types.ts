/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PerfilAcesso = 'Administrador' | 'Gestor' | 'Operacional' | 'Consulta';

export type StatusUsuario = 'ativo' | 'inativo';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilAcesso;
  empresaId: string | null; // legado: null significa acesso geral a todas as empresas
  empresaIds?: string[]; // empresas autorizadas; vazio/ausente significa acesso geral
  status: StatusUsuario;
  dataCriacao: string;
  ultimoAcesso: string;
  senha?: string;
}

export type StatusVeiculo = 'ativo' | 'inativo' | 'manutenção' | 'vendido' | 'bloqueado';

export type TipoUnidade = 'Cavalo' | 'Carreta' | 'Truck' | 'Toco' | 'Bitruck' | 'Baú' | 'Outro' | 'Porta Container';

export interface Veiculo {
  id: string;
  placa: string;
  empresaId: string; // 'BWT' | 'POTENCIAL COMBUSTÍVEIS' | 'POTENCIAL AGRO' | 'BWI' | 'JETA'
  tipoUnidade: TipoUnidade;
  modelo: string;
  ano: number;
  renavam: string;
  chassi?: string;
  cnpj?: string;
  status: StatusVeiculo;
  observacoes?: string;
  crlvAnexoNome?: string;
  crlvAnexoConteudo?: string;
  arrendado?: boolean;
  empresaArrendadora?: string;
  baseOperacional?: string;
  criadoPor: string; // Nome do usuário
  atualizadoPor: string; // Nome do usuário
  dataCadastro: string;
  dataAtualizacao: string;
  
  // Vínculos
  cavaloVinculadoId?: string; // Se for reboque/carreta, ID do cavalo mecânico
  carretaVinculadaId?: string; // Se for cavalo, ID da carreta 1 acoplada
  carreta2VinculadaId?: string; // Se for cavalo, ID da carreta 2 acoplada
}

export type TipoDocumento = string;

export type StatusDocumento = 'Válido' | 'Atenção' | 'Crítico' | 'Vencido' | 'Não aplicável';

export interface Documento {
  id: string;
  veiculoId: string;
  placa: string; // denormalizado para facilitar buscas rápidas
  empresaId: string;
  tipoDocumento: TipoDocumento;
  aplicavel: boolean;
  numeroDocumento: string;
  dataEmissao: string;
  dataVencimento: string;
  arquivoAnexo?: string; // Nome ou Base64 do arquivo simulado
  arquivoAnexoConteudo?: string; // Conteúdo real em Base64 para download/visualização
  statusDocumento: StatusDocumento; // Automático
  observacoes?: string;
  criadoPor: string;
  atualizadoPor: string;
  dataCadastro: string;
  dataAtualizacao: string;
}

export type TipoAcaoAuditoria = 'criação' | 'edição' | 'exclusão' | 'inativação' | 'renovação' | 'vinculação' | 'desvinculação';

export interface AuditoriaLog {
  id: string;
  usuarioId: string; // ID do usuário
  usuarioNome: string; // Nome para visualização rápida
  empresaId: string; // Empresa vinculada ao veículo afetado
  veiculoId: string; // ID do veículo
  placa: string; // Placa para apresentação rápida
  documentoId?: string;
  tipoDocumento?: TipoDocumento;
  tipoAcao: TipoAcaoAuditoria;
  campoAlterado: string; // ex: 'dataVencimento', 'empresa', 'status', etc.
  valorAnterior: string;
  valorNovo: string;
  observacao?: string; // justificativa obrigatória para vencimentos
  dataHora: string;
}

export interface Empresa {
  id: string; // ex: 'BWT', 'POTENCIAL COMBUSTÍVEIS', etc.
  nomeEmpresa: string;
  cnpj?: string;
  status: 'ativo' | 'inativo';
  dataCadastro: string;
}