/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, ShieldAlert, Truck, UserCheck } from 'lucide-react';
import { Usuario } from '../types';
import { dbInLocalStorage } from '../utils/mockdb';

interface LoginProps {
  onLoginSuccess: (user: Usuario) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = dbInLocalStorage.getUsers();
    const matched = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    
    if (!matched) {
      setError('E-mail não cadastrado ou credencial inválida.');
      return;
    }

    if (matched.status === 'inativo') {
      setError('Este usuário está inativo no sistema.');
      return;
    }

    const correctPassword = matched.senha || '123456';
    if (correctPassword !== password) {
      setError('Senha de acesso incorreta. Se for um usuário legado ou se não definiu uma senha, utilize a padrão (123456).');
      return;
    }

    // Simulate successful login, update last access
    const updated = users.map(u => 
      u.id === matched.id ? { ...u, ultimoAcesso: new Date().toISOString() } : u
    );
    dbInLocalStorage.saveUsers(updated);
    onLoginSuccess(matched);
  };

  const loginAs = (userEmail: string) => {
    const users = dbInLocalStorage.getUsers();
    const matched = users.find(u => u.email === userEmail);
    if (matched) {
      const updated = users.map(u => 
        u.id === matched.id ? { ...u, ultimoAcesso: new Date().toISOString() } : u
      );
      dbInLocalStorage.saveUsers(updated);
      onLoginSuccess(matched);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans text-slate-800">
      
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

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex gap-2 items-center font-semibold animate-none"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="email-input">
              E-mail de Acesso
            </label>
            <input
              id="email-input"
              type="email"
              required
              placeholder="email@grpotencial.com.br"
              className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono font-medium"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="password-input">
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
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />
              <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <button
            id="submit-login-btn"
            type="submit"
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            Acessar Sistema
          </button>
        </form>
      </motion.div>
    </div>
  );
}
