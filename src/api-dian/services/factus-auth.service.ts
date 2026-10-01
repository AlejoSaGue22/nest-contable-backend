import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';
import { FactusTokenResponse } from '../interfaces/api-dian-interface';

/**
 * Autenticación OAuth2 contra Factus con caché de token en memoria.
 * Extraído de FactusService para compartirlo sin dependencias circulares
 * (lo usan FactusService y FactusNumberingRangeService).
 */
@Injectable()
export class FactusAuthService {
  private readonly logger = new Logger(FactusAuthService.name);
  private readonly apiUrl: string;
  private readonly oauthUrl: string;
  private readonly environment: string;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Ambiente: sandbox para pruebas, producción para real
    this.environment = this.configService.get<string>('FACTUS_ENVIRONMENT', 'sandbox');

    if (this.environment === 'sandbox') {
      this.apiUrl = 'https://api-sandbox.factus.com.co';
      this.oauthUrl = 'https://api-sandbox.factus.com.co/oauth/token';
    } else {
      this.apiUrl = 'https://api.factus.com.co';
      this.oauthUrl = 'https://api.factus.com.co/oauth/token';
    }

    this.logger.log(`🔌 Factus Auth inicializado en modo: ${this.environment}`);
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  getEnvironment(): string {
    return this.environment;
  }

  get(key: string): string | undefined {
    return this.configService.get<string>(key);
  }

  /**
   * Obtener token de acceso OAuth2 (con caché + ventana de seguridad).
   * El token de Factus expira normalmente en una hora.
   */
  async getToken(): Promise<string> {
    // Si tenemos token válido, retornarlo
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Si tenemos refresh token, intentar renovar
    if (this.refreshToken && this.tokenExpiry && new Date() >= this.tokenExpiry) {
      try {
        await this.renovarToken();
        return this.accessToken!;
      } catch (error) {
        this.logger.warn('No se pudo renovar token, obteniendo uno nuevo...');
      }
    }

    // Obtener nuevo token
    try {
      this.logger.log('🔐 Obteniendo nuevo token de Factus...');

      const credentials = {
        client_id: this.configService.get<string>('FACTUS_CLIENT_ID'),
        client_secret: this.configService.get<string>('FACTUS_CLIENT_SECRET'),
        username: this.configService.get<string>('FACTUS_USERNAME'),
        password: this.configService.get<string>('FACTUS_PASSWORD'),
      };

      if (Object.values(credentials).some((value) => !value)) {
        throw new Error('Faltan credenciales FACTUS para autenticación');
      }

      const data = qs.stringify({ grant_type: 'password', ...credentials });

      const response = await firstValueFrom(
        this.httpService.post<FactusTokenResponse>(this.oauthUrl, data, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      // Renovar antes de la expiración para evitar solicitudes con token vencido.
      const expiresIn = response.data.expires_in || 3600;
      const safetyWindow = Math.min(60, Math.max(1, expiresIn - 1));
      this.tokenExpiry = new Date(Date.now() + (expiresIn - safetyWindow) * 1000);

      this.logger.log(`✅ Token obtenido exitosamente. Expira en ${expiresIn} segundos`);

      return this.accessToken;
    } catch (error) {
      this.logger.error('❌ Error obteniendo token de Factus', error.response?.data || error.message);
      throw new BadRequestException('Error de autenticación con Factus');
    }
  }

  /**
   * Renovar token usando refresh token
   */
  private async renovarToken(): Promise<void> {
    try {
      this.logger.log('🔄 Renovando token de Factus...');

      const data = qs.stringify({
        grant_type: 'refresh_token',
        client_id: this.configService.get<string>('FACTUS_CLIENT_ID'),
        client_secret: this.configService.get<string>('FACTUS_CLIENT_SECRET'),
        refresh_token: this.refreshToken,
      });

      const response = await firstValueFrom(
        this.httpService.post(this.oauthUrl, data, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      const expiresIn = response.data.expires_in || 3600;
      const safetyWindow = Math.min(60, Math.max(1, expiresIn - 1));
      this.tokenExpiry = new Date(Date.now() + (expiresIn - safetyWindow) * 1000);

      this.logger.log(`✅ Token renovado exitosamente. Expira en ${expiresIn} segundos`);
    } catch (error) {
      this.logger.error('❌ Error renovando token', error.response?.data);
      throw error;
    }
  }

  /**
   * Limpiar tokens (útil para testing o logout)
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.logger.log('🔓 Tokens limpiados');
  }
}
