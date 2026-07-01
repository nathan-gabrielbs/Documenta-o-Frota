/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  Truck,
  FileText,
  ClipboardList,
  Users,
  LogOut,
  CheckCircle,
  Shield,
  Globe,
} from 'lucide-react';

import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard';
import Vehicles from './components/Vehicles';
import Documents from './components/Documents';
import Reports from './components/Reports';
import UsersPanel from './components/Users';
import { Usuario } from './types';
import { dbInLocalStorage, isLocalOnly, toggleLocalMode } from './utils/mockdb';
import { formatarNomeEmpresaId } from './utils/empresaUtils';
import { getAuthorizedEmpresaIds, canAccessEmpresa } from './utils/accessControl';
import { authClient } from './auth';

export default function App() {
  // Página de redefinição de senha enviada pelo Neon Auth
  const isResetPasswordPage = window.location.pathname === '/reset-password';

  if (isResetPasswordPage) {
    return <ResetPassword />;
  }

  // Offline local mode fallback state
  const [isOfflineMode, setIsOfflineMode] = useState(() => isLocalOnly());

  React.useEffect(() => {
    const handleModeChange = () => {
      setIsOfflineMode(isLocalOnly());
    };

    window.addEventListener('mockdb-mode-change', handleModeChange);

    return () => {
      window.removeEventListener('mockdb-mode-change', handleModeChange);
    };
  }, []);

  // Session details stored in local state
  const [sessionUser, setSessionUser] = useState<Usuario | null>(null);

  // Password change state
  // Mantido apenas para compatibilidade com seu código antigo.
  // Com Neon Auth, a senha real deve ser alterada pelo fluxo "Esqueci minha senha".
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!sessionUser) {
      setPasswordError('Sessão inválida. Faça login novamente.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve possuir pelo menos 8 caracteres.');
      return;
    }

    if (newPassword === '123456') {
      setPasswordError(
        'A nova senha não pode ser a senha padrão "123456". Escolha uma senha mais segura.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas digitadas não coincidem. Tente novamente.');
      return;
    }

    try {
      const users = dbInLocalStorage.getUsers();

      const updated = users.map((u) =>
        u.id === sessionUser.id ? { ...u, senha: newPassword } : u
      );

      await dbInLocalStorage.saveUsers(updated);

      setPasswordSuccess(true);

      setTimeout(() => {
        setSessionUser({ ...sessionUser, senha: newPassword });
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess(false);
      }, 1500);
    } catch (e: any) {
      setPasswordError('Ocorreu um erro ao atualizar a senha. Tente novamente.');
    }
  };

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'vehicles' | 'documents' | 'reports' | 'users'
  >('dashboard');

  // Shared navigation deep-link parameters
  const [sharedPlateSearch, setSharedPlateSearch] = useState<string>('');

  // Global Company Filter lens
  const [selectedEmpresaGlobal, setSelectedEmpresaGlobal] = useState<string>('');

  const isAdmin = sessionUser?.perfil === 'Administrador';
  const authorizedEmpresaIds = getAuthorizedEmpresaIds(sessionUser);

  React.useEffect(() => {
    if (sessionUser && selectedEmpresaGlobal && !canAccessEmpresa(sessionUser, selectedEmpresaGlobal)) {
      setSelectedEmpresaGlobal('');
    }
  }, [sessionUser, selectedEmpresaGlobal]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('Erro ao encerrar sessão no Neon Auth:', err);
    } finally {
      setSessionUser(null);
      setActiveTab('dashboard');
      setSelectedEmpresaGlobal('');
      setSharedPlateSearch('');
    }
  };

  // Helper navigating dynamically with prefilled plate search queries
  const navigateToVehiclesWithPlate = (plate?: string) => {
    setSharedPlateSearch(plate || '');
    setActiveTab('vehicles');
  };

  const navigateToDocumentsWithPlate = (plate?: string) => {
    setSharedPlateSearch(plate || '');
    setActiveTab('documents');
  };

  // Render gate for unauthenticated sessions
  if (!sessionUser) {
    return <Login onLoginSuccess={setSessionUser} />;
  }

  // ATENÇÃO:
  // Esse bloco é legado do login antigo por senha local.
  // Se você quiser usar somente Neon Auth, pode remover esse bloco futuramente.
  const isDefaultPassword =
    sessionUser && (sessionUser.senha === '123456' || !sessionUser.senha);

  if (sessionUser && isDefaultPassword) {
    return (
      <div
        id="password-change-container"
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans text-slate-800"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm p-8 relative overflow-hidden"
        >
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-600 shadow-sm">
              <Shield className="h-9 w-9 text-amber-500" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold tracking-tight mb-2 uppercase text-slate-900">
              Alteração de Senha Obrigatória
            </h1>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Olá,{' '}
              <strong className="text-slate-700">{sessionUser.nome}</strong>.
              Para garantir a segurança dos dados da frota Potencial S.A., você
              precisa redefinir sua senha padrão antes de prosseguir.
            </p>
          </div>

          {passwordError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex gap-2 items-center font-semibold"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{passwordError}</span>
            </motion.div>
          )}

          {passwordSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex gap-2 items-center font-semibold"
            >
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Senha alterada com sucesso! Redirecionando...</span>
            </motion.div>
          )}

          <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                htmlFor="new-password"
              >
                Nova Senha
              </label>

              <input
                id="new-password"
                type="password"
                required
                placeholder="Insira sua nova senha"
                className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError('');
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                htmlFor="confirm-password"
              >
                Confirmar Nova Senha
              </label>

              <input
                id="confirm-password"
                type="password"
                required
                placeholder="Confirme a nova senha"
                className="w-full bg-white border border-slate-250 rounded-xl px-3.5 py-3 text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                }}
              />
            </div>

            <button
              id="submit-new-password-btn"
              type="submit"
              disabled={passwordSuccess}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              Confirmar Alteração
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 px-4 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 font-bold border border-slate-200 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancelar e Sair
            </button>
          </form>

          <p className="mt-5 text-[11px] leading-relaxed text-slate-400 text-center">
            Observação: esta tela altera apenas a senha local do perfil antigo.
            Para alterar a senha real do Neon Auth, use a opção "Esqueci minha
            senha" na tela de login.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col selection:bg-blue-600 selection:text-white pt-16">
      {/* Primary Top Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] h-16 bg-white/95 backdrop-blur border-b border-slate-200/80 px-6 xl:px-10 py-3 shrink-0 shadow-xs">
        <div className="w-full h-full flex items-center justify-between gap-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-xs">
              <img
                src="/grupo-potencial.png"
                alt="Grupo Potencial"
                title="Grupo Potencial"
                className="h-full w-full object-contain p-1"
              />
            </div>

            <div>
              <span className="font-extrabold tracking-tight text-slate-900 block text-sm sm:text-base leading-tight uppercase font-sans">
                GRUPO POTENCIAL
              </span>

              <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block">
                Conformidade de Documentos de Frota
              </span>
            </div>
          </div>

          {/* User Meta Indicator & Session controllers */}
          <div className="ml-auto flex items-center justify-end gap-6 shrink-0">
            {/* Global Corporate Lens Tag */}
            {selectedEmpresaGlobal && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-150 text-blue-600 rounded-lg text-xs font-semibold shadow-xs">
                <Globe className="h-3.5 w-3.5 animate-pulse" />
                <span>
                  Empresa:{' '}
                  <strong className="font-bold">
                    {formatarNomeEmpresaId(selectedEmpresaGlobal)}
                  </strong>
                </span>
              </div>
            )}

            {/* Profile badge */}
            <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-blue-600 font-bold text-xs shadow-xs">
                {sessionUser.nome.slice(0, 2).toUpperCase()}
              </div>

              <div className="text-left leading-none">
                <span className="text-xs font-bold text-slate-800 block">
                  {sessionUser.nome}
                </span>

                <span className="text-xs text-slate-500 block pt-0.5 font-semibold">
                  {sessionUser.perfil}{' '}
                  {authorizedEmpresaIds.length > 0
                    ? `• ${authorizedEmpresaIds.map(formatarNomeEmpresaId).join(', ')}`
                    : ''}
                </span>
              </div>
            </div>

            {/* Logout dispatch */}
            <button
              onClick={handleLogout}
              title="Encerrar Sessão"
              className="p-2 border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {isOfflineMode && (
        <div
          id="offline-mode-banner"
          className="bg-amber-500 text-white px-6 py-2.5 text-center text-xs font-semibold font-sans flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-4 shadow-xs shrink-0 select-none"
        >
          <div className="flex items-center gap-1.5">
            <span className="inline-block bg-white text-amber-600 rounded-full px-2 py-0.5 text-xs font-extrabold uppercase shadow-xs">
              Modo Local Ativado
            </span>

            <span>
              Suas alterações estão sendo salvas localmente com segurança no seu
              navegador de forma offline!
            </span>
          </div>

          <button
            onClick={async () => {
              if (
                confirm(
                  'Deseja realmente limpar todos os documentos? Todos os números e datas de vencimento serão definidos como em branco.'
                )
              ) {
                localStorage.setItem(
                  'frota_doc_documents_cleared_force_v3',
                  'true'
                );

                toggleLocalMode(true);

                await dbInLocalStorage.clearAllDocumentsAndExpirations();

                alert(
                  'Limpeza efetuada! Todos os documentos foram zerados com sucesso no seu navegador.'
                );
              }
            }}
            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded border border-amber-400 transition-colors cursor-pointer shadow-xs ml-0 sm:ml-2"
          >
            Limpar Todos os Documentos em Branco
          </button>
        </div>
      )}

      {/* Navigation Layout frame */}
      <div className="w-full flex-1 flex flex-col md:flex-row gap-0 relative z-10">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col p-6 gap-2 shadow-xs md:min-h-[calc(100vh-4rem)]">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5 select-none font-sans">
            Navegação Principal
          </div>

          <button
            id="nav-btn-dashboard"
            onClick={() => {
              setActiveTab('dashboard');
              setSharedPlateSearch('');
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all border border-transparent outline-none cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Compass className="h-4 w-4 shrink-0" />
            Visão Geral
          </button>

          <button
            id="nav-btn-vehicles"
            onClick={() => {
              setActiveTab('vehicles');
              setSharedPlateSearch('');
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all border border-transparent outline-none cursor-pointer ${
              activeTab === 'vehicles'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Truck className="h-4 w-4 shrink-0" />
            Veículos
          </button>

          <button
            id="nav-btn-documents"
            onClick={() => {
              setActiveTab('documents');
              setSharedPlateSearch('');
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all border border-transparent outline-none cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            Documentos
          </button>

          <button
            id="nav-btn-reports"
            onClick={() => {
              setActiveTab('reports');
              setSharedPlateSearch('');
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all border border-transparent outline-none cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            Relatórios e Auditorias
          </button>

          {isAdmin && (
            <>
          <div className="h-px bg-slate-100 my-2.5 mx-3" />

          <button
            id="nav-btn-users"
            onClick={() => {
              setActiveTab('users');
              setSharedPlateSearch('');
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all border border-transparent outline-none cursor-pointer ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            Usuários e Controle
          </button>
            </>
          )}

          {/* Quick Stats Sidebar footer card */}
          <div className="mt-auto hidden md:block p-4 border border-slate-200 bg-slate-50 rounded-xl space-y-2 shadow-xs">
            <span className="flex items-center gap-1.5 text-xs text-blue-600 font-bold uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5" />
              Sessão Registrada
            </span>

            <div className="text-sm text-slate-500 leading-relaxed font-sans font-medium">
              Logado:{' '}
              <strong className="text-slate-800 font-bold">
                {sessionUser.nome}
              </strong>
              <br />
              Perfil:{' '}
              <strong className="text-slate-800 font-bold">
                {sessionUser.perfil}
              </strong>
            </div>
          </div>
        </aside>

        {/* Core Main Area */}
        <main className="flex-1 min-w-0 px-6 xl:px-10 py-6 bg-transparent relative">
          <div className="w-full max-w-[1680px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={
                  activeTab + (sharedPlateSearch ? `-${sharedPlateSearch}` : '')
                }
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && (
                  <Dashboard
                    currentUser={sessionUser}
                    onNavigateToVehicles={navigateToVehiclesWithPlate}
                    onNavigateToDocuments={navigateToDocumentsWithPlate}
                    selectedEmpresaGlobal={selectedEmpresaGlobal}
                    setSelectedEmpresaGlobal={setSelectedEmpresaGlobal}
                  />
                )}

                {activeTab === 'vehicles' && (
                  <Vehicles
                    currentUser={sessionUser}
                    initialSearch={sharedPlateSearch}
                    selectedEmpresaGlobal={selectedEmpresaGlobal}
                  />
                )}

                {activeTab === 'documents' && (
                  <Documents
                    currentUser={sessionUser}
                    initialPlateSearch={sharedPlateSearch}
                    selectedEmpresaGlobal={selectedEmpresaGlobal}
                  />
                )}

                {activeTab === 'reports' && (
                  <Reports
                    currentUser={sessionUser}
                    selectedEmpresaGlobal={selectedEmpresaGlobal}
                  />
                )}

                {activeTab === 'users' && isAdmin && (
                  <UsersPanel currentUser={sessionUser} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Universal Footer section */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-xs text-slate-500 shrink-0 font-mono select-none">
        GRUPO POTENCIAL {new Date().getFullYear()} • Sistema Integrado de
        Gestão • Desenvolvido por NG ®
      </footer>
    </div>
  );
}