/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { KeyRound, Truck } from 'lucide-react';
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import { ResetPasswordForm } from '@neondatabase/neon-js/auth/react/ui';

import { authClient } from '../auth';

export default function ResetPassword() {
  const handleBackToLogin = () => {
    window.history.replaceState({}, '', '/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans text-slate-800">
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
            Redefinir senha
          </h1>

          <p className="text-sm text-slate-500 font-medium">
            Informe sua nova senha para acessar o sistema
          </p>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs flex gap-2 items-center font-semibold">
          <KeyRound className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            O link de redefinição é temporário. Se expirar, solicite um novo
            link na tela de login.
          </span>
        </div>

        <div className="reset-password-neon-form">
          <NeonAuthUIProvider authClient={authClient}>
            <ResetPasswordForm
              onSuccess={() => {
                window.history.replaceState({}, '', '/');
                window.location.reload();
              }}
            />
          </NeonAuthUIProvider>
        </div>

        <button
          type="button"
          onClick={handleBackToLogin}
          className="mt-5 w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all border border-slate-200"
        >
          Voltar para o login
        </button>
      </motion.div>
    </div>
  );
}