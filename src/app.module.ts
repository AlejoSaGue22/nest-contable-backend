import { Module, OnModuleInit } from '@nestjs/common';
import { ClientesModule } from './clientes/clientes.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { FacturasVentasModule } from './facturas-ventas/facturas-ventas.module';
import { RolesModule } from './core/roles/roles.module';
import { RolesService } from './core/roles/roles.service';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { FacturasComprasModule } from './facturas-compras/facturas-compras.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { AsientosContablesModule } from './asientos-contables/asientos-contables.module';
import { ArticulosModule } from './articulos/articulos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CuentasService } from './cuentas/cuentas.service';
import { DataSource } from 'typeorm';
import { ApiDianModule } from './api-dian/api-dian.module';
import { CatalogsModule } from './core/catalogs/catalogs.module';
import { CatalogsService } from './core/catalogs/catalogs.service';
import { PagosModule } from './pagos/pagos.module';
import { CuentasBancariasModule } from './cuentas-bancarias/cuentas-bancarias.module';
import { MenuModule } from './core/menu/menu.module';
import { MunicipalitiesModule } from './core/municipalities/municipalities.module';
import { MenuService } from './core/menu/menu.service';
import { MunicipalitiesService } from './core/municipalities/municipalities.service';
import { ReportesModule } from './reportes/reportes-general/reportes.module';
import { ReportesCarteraModule } from './reportes/reportes-cartera/reportes-cartera.module';
import { BancosModule } from './bancos/bancos.module';
import { NotasAjusteModule } from './notas-ajuste/notas-ajuste.module';
import { ImpuestosModule } from './settings/impuestos/impuestos.module';
import { ImpuestosService } from './settings/impuestos/impuestos.service';
import { NotasAjusteComprasModule } from './notas-ajuste-compras/notas-ajuste-compras.module';
import { VendedoresModule } from './settings/vendedores/vendedores.module';
import { NominaModule } from './nomina/nomina.module';
import { ParametrizacionContableModule } from './settings/parametrizacion-contable/parametrizacion-contable.module';
import { CargosModule } from './settings/cargos/cargos.module';
import { CentrosCostosModule } from './settings/centros-costos/centros-costos.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD?.toString() || 'MySecr3tPassWord@as2',
      database: process.env.DB_DATABASE || 'finance_tejo',
      autoLoadEntities: true,
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL) || 60000,
        limit: Number(process.env.THROTTLE_LIMIT) || 100,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClientesModule,
    UsersModule,
    AuthModule,
    FacturasVentasModule,
    RolesModule,
    MenuModule,
    ProveedoresModule,
    FacturasComprasModule,
    ArticulosModule,
    CuentasModule,
    AsientosContablesModule,
    ReportesModule,
    ReportesCarteraModule,
    DashboardModule,
    ApiDianModule,
    MunicipalitiesModule,
    CatalogsModule,
    PagosModule,
    CuentasBancariasModule,
    BancosModule,
    NotasAjusteModule,
    ImpuestosModule,
    NotasAjusteComprasModule,
    VendedoresModule,
    NominaModule,
    ParametrizacionContableModule,
    CargosModule,
    CentrosCostosModule,
  ],
  controllers: [],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly rolesService: RolesService,
    private readonly menuService: MenuService,
    private readonly cuentasService: CuentasService,
    private readonly municipalitiesService: MunicipalitiesService,
    private readonly catalogsService: CatalogsService,
    private readonly impuestosService: ImpuestosService,
    private datasource: DataSource,
  ) { }

  async onModuleInit() {
    // Seed roles por defecto
    // await this.rolesService.seedDefaultRoles();

    // Seed menu por defecto
    // await this.menuService.seedDefaultMenu();

    // await this.cuentasService.seedCuentasBasicasSincronizacion(this.datasource);

    // Seed impuestos por defecto
    // await this.impuestosService.seedDefaultTaxes();

    // Seed municipios si está vacío
    const municipiosCount = (await this.municipalitiesService.findAll()).length;
    if (municipiosCount === 0) {
      console.log('Sincronizando municipios por primera vez...');
      await this.municipalitiesService.syncMunicipalities();
    }

    // Seed otros catálogos
    await this.catalogsService.seedAll();

    console.log('Sistema inicializado con datos por defecto');
  }
}
