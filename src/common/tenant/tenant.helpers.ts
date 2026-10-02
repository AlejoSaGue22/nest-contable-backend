/**
 * Helpers tenant en modo LOG-ONLY (no rompen mono-empresa actual).
 * Enforcement real solo cuando MULTI_EMPRESA_ENFORCED=true.
 */

export function isTenantEnforced(): boolean {
  return process.env.MULTI_EMPRESA_ENFORCED === 'true';
}

/** Prioridad: header X-Company-Id > JWT > empresaId legacy del usuario. */
export function resolveEmpresaId(request: any): string | null {
  const headerId =
    request?.headers?.['x-company-id'] ?? request?.headers?.['X-Company-Id'] ?? null;
  if (typeof headerId === 'string' && headerId.trim() !== '') return headerId;
  if (request?.companyId) return request.companyId;
  if (request?.user?.empresaId) return request.user.empresaId;
  return null;
}

/**
 * Solo valida cuando enforcement está ON y ambos valores existen.
 * En modo OFF (deploy actual) nunca lanza.
 */
export function assertSameEmpresa(bodyEmpresaId: unknown, ctxEmpresaId: unknown): void {
  if (!isTenantEnforced()) return;
  if (!bodyEmpresaId || !ctxEmpresaId) return;
  if (bodyEmpresaId !== ctxEmpresaId) {
    throw new Error('La empresa del cuerpo no coincide con la empresa activa.');
  }
}
