/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Building,
  X,
  AlertTriangle,
  Key,
  Mail,
} from 'lucide-react';
import { Usuario, PerfilAcesso, StatusUsuario } from '../types';
import { dbInLocalStorage, PREDEFINED_COMPANIES } from '../utils/mockdb';
import { EMPRESAS_PADRAO, obterNomeEmpresa } from '../utils/empresaUtils';
import { authClient } from '../auth';

interface UsersProps {
  currentUser: Usuario;
}

const AUTH_MANAGED_PASSWORD_PLACEHOLDER = 'NEON_AUTH_MANAGED';

export default function UsersPanel({ currentUser }: UsersProps) {
  const [users, setUsers] = useState<Usuario[]>(() => dbInLocalStorage.getUsers());

  const companyOptions =
    PREDEFINED_COMPANIES.length > 0 ? PREDEFINED_COMPANIES : EMPRESAS_PADRAO;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [systemAlertMessage, setSystemAlertMessage] = useState<string | null>(null);
  const [sendingResetForUserId, setSendingResetForUserId] = useState<string | null>(null);

  // Form Fields
  const [inputNome, setInputNome] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [inputPerfil, setInputPerfil] = useState<PerfilAcesso>('Operacional');
  const [inputEmpresa, setInputEmpresa] = useState<string>('');

  const isAdmin = currentUser.perfil === 'Administrador';

  useEffect(() => {
    const handleUpdate = () => {
      setUsers(dbInLocalStorage.getUsers());
    };

    window.addEventListener('mockdb-update', handleUpdate);

    return () => {
      window.removeEventListener('mockdb-update', handleUpdate);
    };
  }, []);

  // Migração de segurança:
  // remove senhas antigas salvas no localStorage e troca por um marcador sem valor real.
  useEffect(() => {
    const sanitizeStoredPasswords = async () => {
      const localUsers = dbInLocalStorage.getUsers();

      const hasRealPasswordStored = localUsers.some(
        (u) => u.senha && u.senha !== AUTH_MANAGED_PASSWORD_PLACEHOLDER
      );

      if (!hasRealPasswordStored) return;

      const sanitized = localUsers.map((u) => ({
        ...u,
        senha: AUTH_MANAGED_PASSWORD_PLACEHOLDER,
      }));

      await dbInLocalStorage.saveUsers(sanitized);
      setUsers(sanitized);
    };

    sanitizeStoredPasswords();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = inputNome.trim();
    const cleanEmail = inputEmail.trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      setFormError('Preencha os campos obrigatórios.');
      return;
    }

    const emailCheck = users.some(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (emailCheck) {
      setFormError('Este e-mail de acesso já está cadastrado.');
      return;
    }

    const newUser: Usuario = {
      id: `usr-${Date.now()}`,
      nome: cleanName,
      email: cleanEmail,
      perfil: inputPerfil,
      empresaId: inputEmpresa || null,
      status: 'ativo',
      dataCriacao: new Date().toISOString().split('T')[0],
      ultimoAcesso: 'Nunca logou',

      // Não armazenar senha real no sistema.
      // A senha real é criada e gerenciada pelo Neon Auth.
      senha: AUTH_MANAGED_PASSWORD_PLACEHOLDER,
    };

    const updated = [...users, newUser];

    await dbInLocalStorage.saveUsers(updated);
    setUsers(updated);
    setIsAddOpen(false);

    setInputNome('');
    setInputEmail('');
    setInputPerfil('Operacional');
    setInputEmpresa('');

    setSystemAlertMessage(
      `Usuário ${cleanName} cadastrado com sucesso. A senha não é definida pelo painel administrativo. O usuário deve acessar a tela de login e usar "Primeiro acesso / Criar senha" para cadastrar a senha no Neon Auth.`
    );
  };

  const toggleUserStatus = async (target: Usuario) => {
    if (target.id === currentUser.id) {
      setSystemAlertMessage('Você não pode inativar seu próprio perfil atual.');
      return;
    }

    const updated = users.map((u) => {
      if (u.id === target.id) {
        return {
          ...u,
          status:
            u.status === 'ativo'
              ? ('inativo' as StatusUsuario)
              : ('ativo' as StatusUsuario),
        };
      }

      return u;
    });

    await dbInLocalStorage.saveUsers(updated);
    setUsers(updated);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === currentUser.id) {
      setSystemAlertMessage('Você não pode excluir seu próprio perfil atual.');
      return;
    }

    const updated = users.filter((u) => u.id !== id);

    await dbInLocalStorage.saveUsers(updated);
    setUsers(updated);
    setDeleteConfirmUser(null);

    setSystemAlertMessage(
      `O usuário ${name} foi removido do perfil interno do sistema. Caso ele também exista no Neon Auth, remova ou desative o acesso no painel do Neon Auth.`
    );
  };

  const handleSendPasswordReset = async (target: Usuario) => {
    setSendingResetForUserId(target.id);
    setSystemAlertMessage(null);

    try {
      const result = await authClient.requestPasswordReset({
        email: target.email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        setSystemAlertMessage(
          result.error.message ||
            `Não foi possível enviar o link de redefinição para ${target.email}.`
        );
        return;
      }

      setSystemAlertMessage(
        `Link de redefinição de senha enviado para ${target.email}. Por segurança, a senha não é exibida nem alterada pelo administrador.`
      );
    } catch (err) {
      console.error('Erro ao enviar reset de senha:', err);

      setSystemAlertMessage(
        `Erro ao enviar o link de redefinição para ${target.email}. Verifique se o usuário existe no Neon Auth.`
      );
    } finally {
      setSendingResetForUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <Users className="text-blue-600 h-6 w-6" />
            Configuração de Usuários do Sistema
          </h1>

          <p className="text-sm text-slate-500">
            Crie perfis internos, configure permissões por empresa e controle o status de acesso.
          </p>
        </div>

        {isAdmin && !isAddOpen && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs select-none transition-all active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" />
            Adicionar Novo Usuário
          </button>
        )}
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex gap-2 font-medium">
        <Shield className="h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <strong className="block mb-0.5 text-blue-900 font-bold">
            Segurança de credenciais
          </strong>
          As senhas são gerenciadas pelo Neon Auth.
        </div>
      </div>

      {!isAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2 font-medium">
          <Shield className="h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <strong className="block mb-0.5 text-amber-900 font-bold">
              Permissão Administrativa Exigida
            </strong>
            Seu nível de perfil atual é <strong>{currentUser.perfil}</strong>.
            Apenas usuários com o perfil <strong>Administrador</strong> estão
            autorizados a alterar ou cadastrar novos integrantes.
          </div>
        </div>
      )}

      {/* Grid wrapper for add form + list */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Col: Add Form */}
        {isAdmin && isAddOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Novo Integrante
              </h3>

              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {formError && (
              <div className="p-2 bg-rose-50 text-rose-600 rounded text-sm border border-rose-200 font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                  Nome Completo *
                </label>

                <input
                  id="add-username-input"
                  type="text"
                  required
                  placeholder="Nome do integrante..."
                  value={inputNome}
                  onChange={(e) => setInputNome(e.target.value)}
                  className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                  E-mail de Login *
                </label>

                <input
                  id="add-useremail-input"
                  type="email"
                  required
                  placeholder="exemplo@potencial.com.br"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all font-mono font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs leading-relaxed">
                A senha não é cadastrada nesta tela. Após criar o perfil, o
                usuário deve acessar o login e clicar em{' '}
                <strong>Primeiro acesso / Criar senha</strong>.
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                  Perfil de Acesso *
                </label>

                <select
                  id="add-userprofile-select"
                  value={inputPerfil}
                  onChange={(e) => setInputPerfil(e.target.value as PerfilAcesso)}
                  className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-10 text-sm font-semibold cursor-pointer"
                >
                  <option value="Administrador">Administrador (Acesso Total)</option>
                  <option value="Gestor">Gestor (Aprovar e ver Auditorias)</option>
                  <option value="Operacional">Operacional (Cadastrar e Editar)</option>
                  <option value="Consulta">Consulta (Visualizar Apenas)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold uppercase tracking-wider text-xs">
                  Limitar à Empresa (Opcional)
                </label>

                <select
                  id="add-usercompany-select"
                  value={inputEmpresa}
                  onChange={(e) => setInputEmpresa(e.target.value)}
                  className="w-full bg-white border border-slate-250 px-3 py-2 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none h-10 text-sm font-semibold cursor-pointer"
                >
                  <option value="">Acesso Geral (Todas Empresas)</option>

                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {obterNomeEmpresa(c.id, companyOptions)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 font-semibold">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List Table */}
        <div
          className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm ${
            isAdmin && isAddOpen ? 'xl:col-span-2' : 'lg:col-span-3'
          }`}
        >
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold tracking-wider text-xs uppercase">
                  <th className="p-4">Colaborador / Acesso</th>
                  <th className="p-4">Perfil</th>
                  <th className="p-4">Empresa Autorizada</th>
                  <th className="p-4">Criação / Último Acesso</th>
                  <th className="p-4 text-center">Status</th>
                  {isAdmin && <th className="p-4 text-right">Ações</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.map((usr) => {
                  const isActive = usr.status === 'ativo';
                  const isCurrent = usr.id === currentUser.id;
                  const isSendingReset = sendingResetForUserId === usr.id;

                  return (
                    <tr
                      key={usr.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 text-sm block">
                            {usr.nome}{' '}
                            {isCurrent && (
                              <strong className="text-blue-600 text-xs font-bold select-none ml-1">
                                (Você)
                              </strong>
                            )}
                          </span>

                          <span className="text-xs text-slate-500 block font-mono">
                            {usr.email}
                          </span>

                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold border ${
                            usr.perfil === 'Administrador'
                              ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : usr.perfil === 'Gestor'
                                ? 'text-purple-700 bg-purple-50 border-purple-200'
                                : usr.perfil === 'Operacional'
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-slate-600 bg-slate-100 border-slate-200'
                          }`}
                        >
                          {usr.perfil}
                        </span>
                      </td>

                      <td className="p-4">
                        {usr.empresaId ? (
                          <span className="text-slate-800 font-bold flex items-center gap-1">
                            <Building className="h-3 w-3 text-slate-400 shrink-0" />
                            {obterNomeEmpresa(usr.empresaId, companyOptions)}
                          </span>
                        ) : (
                          <span className="text-slate-450 italic font-medium">
                            Geral (Toda a Frota)
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-slate-500 text-sm font-medium">
                        <span className="block text-slate-700">
                          Cadastrado: {usr.dataCriacao}
                        </span>

                        <span
                          className="text-xs text-slate-400 block truncate max-w-[150px]"
                          title={usr.ultimoAcesso}
                        >
                          Alt:{' '}
                          {usr.ultimoAcesso !== 'Nunca logou'
                            ? new Date(usr.ultimoAcesso).toLocaleString('pt-BR')
                            : 'Nunca logou'}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <button
                          disabled={!isAdmin || isCurrent}
                          onClick={() => toggleUserStatus(usr)}
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-xs select-none ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          } ${
                            isAdmin && !isCurrent
                              ? 'cursor-pointer'
                              : 'cursor-default'
                          }`}
                        >
                          {isActive ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      {isAdmin && (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSendPasswordReset(usr)}
                              disabled={isSendingReset}
                              className="p-1 px-1.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
                              title="Enviar link de redefinição de senha"
                            >
                              {isSendingReset ? (
                                <Mail className="h-3.5 w-3.5 animate-pulse" />
                              ) : (
                                <Key className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <button
                              disabled={isCurrent}
                              onClick={() =>
                                setDeleteConfirmUser({
                                  id: usr.id,
                                  name: usr.nome,
                                })
                              }
                              className="p-1 px-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-xs"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div
          id="delete-user-confirm-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
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
                Excluir usuário permanentemente?
              </h3>
            </div>

            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Gostaria de remover permanentemente o usuário{' '}
              <strong className="text-slate-900 font-bold">
                {deleteConfirmUser.name}
              </strong>{' '}
              do sistema? Esta ação removerá seu perfil interno de acesso.
            </p>

            <div className="flex justify-end gap-4 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-200 shadow-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={() =>
                  handleDeleteUser(deleteConfirmUser.id, deleteConfirmUser.name)
                }
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
        <div
          id="user-alert-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 font-sans text-xs text-center"
          >
            <div className="mx-auto w-12 h-12 flex items-center justify-center text-amber-500 bg-amber-50 rounded-full mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-2">Atenção</h4>

            <p className="text-slate-600 mb-5 leading-relaxed">
              {systemAlertMessage}
            </p>

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