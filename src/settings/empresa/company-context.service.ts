import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity';

@Injectable({ scope: Scope.REQUEST })
export class CompanyContext {
  private activeCompanyId: string | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: any,
    @InjectRepository(Empresa)
    private readonly empresaRepository: Repository<Empresa>,
  ) {}

  async getActiveCompanyId(): Promise<string> {
    if (this.activeCompanyId) {
      return this.activeCompanyId;
    }

    // 1. Check if already resolved by request (e.g. from JWT or interceptor)
    if (this.request && this.request.companyId) {
      this.activeCompanyId = this.request.companyId;
      return this.activeCompanyId!;
    }

    // 2. Fallback legacy mono-empresa (deploy actual): Query default company ID from DB.
    // NO cambiar antes del deploy: enforcement estricto queda tras MULTI_EMPRESA_ENFORCED=true.
    const empresa = await this.empresaRepository.findOne({ where: {} });
    if (empresa) {
      this.activeCompanyId = empresa.id;
      return empresa.id;
    }

    throw new Error('No se encontró ninguna empresa activa configurada en el sistema.');
  }

  /**
   * Variante no-lanzadora para modo log-only pre-deploy.
   * Devuelve null si no hay contexto, en vez de fallback silencioso o throw.
   */
  async getActiveCompanyIdSafe(): Promise<string | null> {
    if (this.activeCompanyId) return this.activeCompanyId;
    if (this.request?.companyId) {
      this.activeCompanyId = this.request.companyId;
      return this.activeCompanyId;
    }
    return null;
  }
}
