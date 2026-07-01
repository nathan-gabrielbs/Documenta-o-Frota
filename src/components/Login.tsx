/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, ShieldAlert, Truck } from 'lucide-react';
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

    const matched = users.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

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
          result.error.message ||
            'Não foi possível criar o acesso no Neon Auth.'
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
      ? 'mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex gap-2 items-center font-semibold animate-none'
      : 'mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex gap-2 items-center font-semibold animate-none';

  const alertIconClasses =
    messageType === 'success'
      ? 'h-4 w-4 shrink-0 text-emerald-600'
      : 'h-4 w-4 shrink-0 text-rose-500';

  return (
    <div
      id="login-container"
      className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans text-slate-800"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm p-8 relative overflow-hidden"
      >
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-600 shadow-sm">
            <Truck className="h-9 w-9" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
            Controle de Documentos de Frota
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Entre para gerenciar a conformidade e auditorias da transportadora
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
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              htmlFor="email-input"
            >
              E-mail de Acesso
            </label>

            <input
              id="email-input"
              type="email"
              required
              placeholder="email@grpotencial.com.br"
              className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono font-medium"
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
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5"
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
                className="w-full bg-white border border-slate-250 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                value={password}
                disabled={loading}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearMessage();
                }}
              />

              <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <button
            id="submit-login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            {loading ? 'Autenticando, aguarde...' : 'Acessar Sistema'}
          </button>

          <button
            id="first-access-btn"
            type="button"
            onClick={handleFirstAccess}
            disabled={loading}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 font-bold rounded-xl text-sm transition-all border border-slate-200"
          >
            {loading ? 'Processando, aguarde...' : 'Primeiro acesso / Criar senha'}
          </button>

          <button
            id="forgot-password-btn"
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            className="w-full py-2 px-4 text-slate-500 hover:text-blue-600 disabled:text-slate-300 font-semibold text-xs transition-all"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="mt-5 text-[11px] leading-relaxed text-slate-400 text-center">
          No primeiro acesso, informe seu e-mail cadastrado no sistema e crie uma
          senha com no mínimo 8 caracteres.
        </p>
      </motion.div>
    </div>
  );
}