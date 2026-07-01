/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Truck,
  FileCheck2,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { Usuario } from '../types';
import { dbInLocalStorage } from '../utils/mockdb';
import { authClient } from '../auth';

interface LoginProps {
  onLoginSuccess: (user: Usuario) => void;
}

type AlertType = 'error' | 'success';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<AlertType>('error');

  const [loading, setLoading] = useState(false);

  const showError = (text: string) => {
    setMessageType('error');
    setMessage(text);
  };

  const showSuccess = (text: string) => {
    setMessageType('success');
    setMessage(text);
  };

  const clearMessage = () => {
    setMessage('');
  };

  const getCleanEmail = () => {
    return email.trim().toLowerCase();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    const cleanEmail = getCleanEmail();

    if (!cleanEmail || !password) {
      showError('Informe o e-mail e a senha para acessar o sistema.');
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email: cleanEmail,
        password,
        rememberMe: true,
      });

      if (result.error) {
        showError(
          result.error.message ||
            'E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.'
        );
        return;
      }

      const neonUser = result.data?.user;

      if (!neonUser?.email) {
        showError('Não foi possível validar o usuário autenticado no Neon Auth.');
        return;
      }

      const users = dbInLocalStorage.getUsers();

      const matched = users.find(
        (u) => u.email.toLowerCase() === neonUser.email.toLowerCase()
      );

      if (!matched) {
        await authClient.signOut();

        showError(
          'Login autenticado no Neon Auth, mas este e-mail ainda não possui cadastro/perfil no sistema.'
        );
        return;
      }

      if (matched.status === 'inativo') {
        await authClient.signOut();

        showError('Este usuário está inativo no sistema.');
        return;
      }

      const usuarioAtualizado: Usuario = {
        ...matched,
        ultimoAcesso: new Date().toISOString(),
      };

      const updated = users.map((u) =>
        u.id === matched.id ? usuarioAtualizado : u
      );

      dbInLocalStorage.saveUsers(updated);

      onLoginSuccess(usuarioAtualizado);
    } catch (err) {
      console.error('Erro ao autenticar com Neon Auth:', err);

      showError(
        'Não foi possível autenticar no Neon Auth. Verifique o e-mail, senha e a configuração VITE_NEON_AUTH_URL.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccess = async () => {
    clearMessage();

    const cleanEmail = getCleanEmail();

    if (!cleanEmail || !password) {
      showError('Informe o e-mail e uma senha para criar o primeiro acesso.');
      return;
    }

    if (password.length < 8) {
      showError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    const users = dbInLocalStorage.getUsers();

    const matched = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!matched) {
      showError(
        'Este e-mail ainda não possui cadastro/perfil no sistema. Cadastre o usuário no sistema antes de criar o acesso no Neon Auth.'
      );
      return;
    }

    if (matched.status === 'inativo') {
      showError('Este usuário está inativo no sistema.');
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.signUp.email({
        email: cleanEmail,
        password,
        name: cleanEmail.split('@')[0] || cleanEmail,
      });

      if (result.error) {
        showError(
          result.error.message || 'Não foi possível criar o acesso no Neon Auth.'
        );
        return;
      }

      showSuccess(
        'Acesso criado com sucesso. Agora clique em Acessar Sistema usando este e-mail e senha.'
      );
    } catch (err) {
      console.error('Erro ao criar primeiro acesso no Neon Auth:', err);

      showError(
        'Erro ao criar o primeiro acesso no Neon Auth. Se o usuário já existir no Neon Auth, apague-o no painel ou use redefinição de senha.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    clearMessage();

    const cleanEmail = getCleanEmail();

    if (!cleanEmail) {
      showError('Informe seu e-mail para receber o link de redefinição de senha.');
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: cleanEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        showError(
          result.error.message ||
            'Não foi possível enviar o link de redefinição de senha.'
        );
        return;
      }

      showSuccess(
        'Enviamos um link de redefinição de senha para o seu e-mail. Verifique sua caixa de entrada e spam.'
      );
    } catch (err) {
      console.error('Erro ao solicitar redefinição de senha:', err);

      showError(
        'Erro ao solicitar redefinição de senha. Verifique o e-mail informado e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const alertClasses =
    messageType === 'success'
      ? 'mb-5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex gap-2 items-center font-semibold shadow-sm'
      : 'mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex gap-2 items-center font-semibold shadow-sm';

  const alertIconClasses =
    messageType === 'success'
      ? 'h-4 w-4 shrink-0 text-emerald-600'
      : 'h-4 w-4 shrink-0 text-rose-500';

  return (
    <div
      id="login-container"
      className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_transparent_32%),linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_42%,_#f8fafc_100%)] selection:bg-blue-600 selection:text-white font-sans text-slate-800"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-28 -left-28 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-20 right-[-120px] w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-[-160px] left-1/3 w-[480px] h-[480px] rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8 lg:px-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-6 items-stretch">
          <motion.section
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="hidden lg:flex relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 text-white border border-white/10 shadow-2xl min-h-[640px]"
          >
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(120deg,_transparent_0%,_rgba(255,255,255,0.18)_45%,_transparent_70%)]" />
            <div className="absolute -right-28 -top-28 w-80 h-80 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -left-24 bottom-10 w-72 h-72 rounded-full bg-amber-300/20 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between p-10 xl:p-12 w-full">
              <div>
                <div className="inline-flex items-center gap-3 px-3 py-2 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm shadow-sm">
                  <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm">
                    <img
                      src="/grupo-potencial.png"
                      alt="Grupo Potencial"
                      title="Grupo Potencial"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="leading-tight">
                    <span className="block text-sm font-extrabold tracking-tight uppercase">
                      Grupo Potencial
                    </span>
                    <span className="block text-[11px] text-blue-100 font-semibold uppercase tracking-widest">
                      Frota • Documentos • Auditoria
                    </span>
                  </div>
                </div>

                <div className="mt-14 max-w-xl">
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, delay: 0.15, ease: 'easeOut' }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-300/20 text-blue-100 text-xs font-bold uppercase tracking-widest mb-5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Sistema corporativo integrado
                  </motion.div>

                  <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.04]">
                    Controle profissional da conformidade documental da frota.
                  </h1>

                  <p className="mt-5 text-sm xl:text-base text-blue-100/90 leading-relaxed font-medium max-w-lg">
                    Acesse uma visão centralizada para acompanhar vencimentos,
                    pendências, auditorias e indicadores por empresa do Grupo Potencial.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.25, ease: 'easeOut' }}
                  className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-sm"
                >
                  <Truck className="h-5 w-5 text-blue-200 mb-3" />
                  <span className="block text-lg font-black leading-none">Frota</span>
                  <span className="block text-[11px] text-blue-100/80 mt-1 font-semibold">
                    ativos vinculados
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.35, ease: 'easeOut' }}
                  className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-sm"
                >
                  <FileCheck2 className="h-5 w-5 text-emerald-200 mb-3" />
                  <span className="block text-lg font-black leading-none">Docs</span>
                  <span className="block text-[11px] text-blue-100/80 mt-1 font-semibold">
                    CIV, CIPP, CRLV
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.45, ease: 'easeOut' }}
                  className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-sm"
                >
                  <ShieldCheck className="h-5 w-5 text-amber-200 mb-3" />
                  <span className="block text-lg font-black leading-none">Seguro</span>
                  <span className="block text-[11px] text-blue-100/80 mt-1 font-semibold">
                    acesso protegido
                  </span>
                </motion.div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="w-full flex items-center justify-center"
          >
            <div className="w-full max-w-md bg-white/95 backdrop-blur border border-white/70 rounded-[2rem] shadow-2xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-blue-500 to-amber-400" />
              <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-blue-100/70 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex justify-center mb-5">
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                    className="relative"
                  >
                    <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl" />
                    <div className="relative h-20 w-20 rounded-3xl bg-white border border-slate-200 flex items-center justify-center p-2.5 shadow-lg">
                      <img
                        src="/grupo-potencial.png"
                        alt="Grupo Potencial"
                        title="Grupo Potencial"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </motion.div>
                </div>

                <div className="text-center mb-7">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                    <LockKeyhole className="h-3 w-3" />
                    Acesso Restrito
                  </span>

                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 mb-2 uppercase">
                    GRUPO POTENCIAL
                  </h1>

                  <p className="text-sm text-slate-500 font-semibold leading-relaxed">
                    Controle de Documentos de Frota
                    <span className="block text-xs font-medium mt-1">
                      Conformidade, auditoria e gestão operacional em um só lugar.
                    </span>
                  </p>
                </div>

                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={alertClasses}
                  >
                    <ShieldAlert className={alertIconClasses} />
                    <span>{message}</span>
                  </motion.div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label
                      className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5"
                      htmlFor="email-input"
                    >
                      E-mail de Acesso
                    </label>

                    <input
                      id="email-input"
                      type="email"
                      required
                      placeholder="email@grpotencial.com.br"
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-mono font-semibold shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                      value={email}
                      disabled={loading}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearMessage();
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5"
                      htmlFor="password-input"
                    >
                      Senha do Usuário
                    </label>

                    <div className="relative">
                      <input
                        id="password-input"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-4 pr-11 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-semibold shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                        value={password}
                        disabled={loading}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearMessage();
                        }}
                      />

                      <KeyRound className="absolute right-4 top-4 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <button
                    id="submit-login-btn"
                    type="submit"
                    disabled={loading}
                    className="group relative w-full overflow-hidden py-3.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-blue-700/20 cursor-pointer active:scale-[0.98]"
                  >
                    <span className="absolute inset-0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <span className="relative">
                      {loading ? 'Autenticando, aguarde...' : 'Acessar Sistema'}
                    </span>
                  </button>

                  <button
                    id="first-access-btn"
                    type="button"
                    onClick={handleFirstAccess}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 font-black rounded-2xl text-sm transition-all border border-slate-200 shadow-sm"
                  >
                    {loading
                      ? 'Processando, aguarde...'
                      : 'Primeiro acesso / Criar senha'}
                  </button>

                  <button
                    id="forgot-password-btn"
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="w-full py-2 px-4 text-slate-500 hover:text-blue-700 disabled:text-slate-300 font-bold text-xs transition-all"
                  >
                    Esqueci minha senha
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-100">
                  <p className="text-[11px] leading-relaxed text-slate-400 text-center font-medium">
                    No primeiro acesso, informe seu e-mail cadastrado no sistema e
                    crie uma senha com no mínimo 8 caracteres.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
