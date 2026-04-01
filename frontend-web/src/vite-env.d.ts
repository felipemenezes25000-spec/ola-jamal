/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API (ex: https://renovejasaude.com.br). Usado para chamadas diretas ao backend. */
  readonly VITE_API_URL?: string;
  /** ID do formulário Formspree (ex: xyzabc). Se definido, o formulário de contato envia direto para seu email. */
  readonly VITE_FORMSPREE_FORM_ID?: string;
  /** Chave pública VAPID para push notifications via Web Push API. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Identificador do portal (ex: "doctor", "patient"). */
  readonly VITE_PORTAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
