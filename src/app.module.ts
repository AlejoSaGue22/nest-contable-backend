import { Module, OnModuleInit } from '@nestjs/common';
import { ClientesModule } from './clientes/clientes.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { FacturasVentasModule } from './facturas-ventas/facturas-ventas.module';
import { RolesModule } from './roles/roles.module';
import { MenuModule } from './menu/menu.module';
import { RolesService } from './roles/roles.service';
import { MenuService } from './menu/menu.service';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { FacturasComprasModule } from './facturas-compras/facturas-compras.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { AsientosContablesModule } from './asientos-contables/asientos-contables.module';
import { ReportesModule } from './reportes/reportes.module';
import { ArticulosModule } from './articulos/articulos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CuentasService } from './cuentas/cuentas.service';
import { DataSource } from 'typeorm';
import { MunicipalitiesModule } from './municipalities/municipalities.module';
import { MunicipalitiesService } from './municipalities/municipalities.service';
import { ApiDianModule } from './api-dian/api-dian.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { CatalogsService } from './catalogs/catalogs.service';
import { PagosModule } from './pagos/pagos.module';
import { CuentasBancariasModule } from './cuentas-bancarias/cuentas-bancarias.module';

@Module({
    imports: [TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'finance_tejo',
      // logging: true,
      autoLoadEntities: true,
      synchronize: true // ⚠️ nunca true en producción
    }),
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
    DashboardModule,
    ApiDianModule,
    MunicipalitiesModule,
    CatalogsModule,
    PagosModule,
    CuentasBancariasModule
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
    private datasource: DataSource
  ) { }

  async onModuleInit() {
    // Seed roles por defecto
    await this.rolesService.seedDefaultRoles();

    // Seed menu por defecto
    await this.menuService.seedDefaultMenu();

    await this.cuentasService.seedCuentasBasicas(this.datasource)

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


