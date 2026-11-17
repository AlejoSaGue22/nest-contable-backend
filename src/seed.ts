import { AppDataSource } from './data-source';
import * as bcryptjs from 'bcryptjs';

import { Empresa } from './settings/empresa/entities/empresa.entity';
import { Role } from './core/roles/entities/role.entity';
import { User } from './users/entities/user.entity';
import { UserEmpresa } from './users/entities/user-empresa.entity';
import { SystemRole } from './common/constants/roles.constants';
import { Cliente } from './clientes/entities/cliente.entity';
import { Proveedor } from './proveedores/entities/proveedor.entity';
import { Articulo, ArticuloTipo } from './articulos/entities/articulos.entity';
import { MovimientoInventario, TipoMovimientoInventario, DocumentoInventario } from './inventario/entities/movimiento-inventario.entity';
import { FacturasVenta } from './facturas-ventas/entities/facturas-venta.entity';
import { ItemsFacturaVenta } from './facturas-ventas/entities/items-facturas-venta.entity';
import { DianStatus, FormaPago, InvoiceStatus, TipoFactura } from './facturas-ventas/enums/factura-venta.enum';
import { PaymentStatus } from './pagos/enums/pago.enum';
import { FacturaCompra, GastoEstado } from './facturas-compras/entities/factura-compra.entity';
import { FacturaCompraDetalle } from './facturas-compras/entities/factura-compra-detalle.entity';
import { Impuesto } from './settings/impuestos/entities/impuesto.entity';
import { CategoriaArticulo } from './core/catalogs/entities/categorias-articulos-entity';
import { TipoCategoria } from './common/constants/categorias-articulos.config';
import { UnidadMedida } from './core/catalogs/entities/unidad-medida.entity';
import { Municipality } from './core/municipalities/entities/municipality.entity';
import { TipoDocumento } from './core/catalogs/entities/tipo-documento.entity';
import { CanalVenta } from './core/catalogs/entities/canal-venta.entity';
import { MetodoPago } from './core/catalogs/entities/metodo-pago.entity';

async function runSeed() {
  console.log('🌱 ========================================================');
  console.log('🌱 INICIANDO PROCESO DE SEED - ENTORNO DEMO CONTABLE');
  console.log('🌱 (Sin sincronizar PUC: el PUC se gestiona en AppModule)');
  console.log('🌱 ========================================================');

  // 1. Inicializar conexión directa vía AppDataSource
  console.log('⏳ Conectando a la base de datos...');
  await AppDataSource.initialize();
  console.log('✅ Base de datos conectada.');

  try {
    // ----------------------------------------------------
    // 2. VALIDAR O CREAR ROLES Y CATÁLOGOS BASE AUXILIARES
    // ----------------------------------------------------
    const roleRepo = AppDataSource.getRepository(Role);
    let adminRole = await roleRepo.findOne({ where: { name: SystemRole.SUPER_ADMIN } });
    if (!adminRole) {
      adminRole = await roleRepo.findOne({ where: { name: SystemRole.ADMIN } });
    }
    if (!adminRole) {
      adminRole = await roleRepo.save(
        roleRepo.create({
          name: SystemRole.ADMIN,
          description: 'Administrador del sistema con acceso total',
          isSystem: true,
          isActive: true,
        })
      );
    }

    const impuestoRepo = AppDataSource.getRepository(Impuesto);
    let iva19 = await impuestoRepo.findOne({ where: { tarifa: 19 } });
    if (!iva19) {
      iva19 = await impuestoRepo.save(
        impuestoRepo.create({
          nombre: 'IVA 19%',
          tipo: 'IVA',
          tarifa: 19,
          descripcion: 'IVA general 19%',
          activo: true,
        })
      );
    }

    let iva5 = await impuestoRepo.findOne({ where: { tarifa: 5 } });
    if (!iva5) {
      iva5 = await impuestoRepo.save(
        impuestoRepo.create({
          nombre: 'IVA 5%',
          tipo: 'IVA',
          tarifa: 5,
          descripcion: 'IVA reducido 5%',
          activo: true,
        })
      );
    }

    let ivaExento = await impuestoRepo.findOne({ where: { tarifa: 0 } });
    if (!ivaExento) {
      ivaExento = await impuestoRepo.save(
        impuestoRepo.create({
          nombre: 'IVA Exento 0%',
          tipo: 'IVA',
          tarifa: 0,
          descripcion: 'Bienes o servicios exentos',
          activo: true,
        })
      );
    }

    const catArticuloRepo = AppDataSource.getRepository(CategoriaArticulo);
    let catProducto = await catArticuloRepo.findOne({ where: { codigo: 'productos' } });
    if (!catProducto) {
      const nuevo = catArticuloRepo.create({
        codigo: 'productos',
        nombre: 'Productos',
        tipo: TipoCategoria.VENTA,
        descripcion: 'Artículos de inventario y venta',
        state: true,
      });
      catProducto = await catArticuloRepo.save(nuevo);
    }

    let catServicio = await catArticuloRepo.findOne({ where: { codigo: 'servicios' } });
    if (!catServicio) {
      const nuevo = catArticuloRepo.create({
        codigo: 'servicios',
        nombre: 'Servicios',
        tipo: TipoCategoria.SERVICIO,
        descripcion: 'Servicios profesionales',
        state: true,
      });
      catServicio = await catArticuloRepo.save(nuevo);
    }

    const unidadMedidaRepo = AppDataSource.getRepository(UnidadMedida);
    let unidadDefecto = await unidadMedidaRepo.findOne({ where: { codigo: '94' } }) ||
      await unidadMedidaRepo.findOne({ where: { state: true } });
    if (!unidadDefecto) {
      unidadDefecto = await unidadMedidaRepo.save(
        unidadMedidaRepo.create({
          id: '70',
          codigo: '94',
          nombre: 'Unidad',
          state: true,
        })
      );
    }

    const munRepo = AppDataSource.getRepository(Municipality);
    let municipioDefault = await munRepo.findOne({ where: { code: '11001' } });
    if (!municipioDefault) {
      const primerMunicipio = await munRepo.find({ take: 1 });
      municipioDefault = primerMunicipio.length > 0 ? primerMunicipio[0] : null;
    }
    if (!municipioDefault) {
      municipioDefault = await munRepo.save(
        munRepo.create({
          id: 11001,
          code: '11001',
          name: 'Bogotá, D.C.',
          department: 'Bogotá, D.C.',
          departmentCode: '11',
          departmentName: 'Bogotá, D.C.',
        })
      );
    }
    const ciudadId = municipioDefault.id;

    // Validar o crear Tipos de Documento (NIT y CC)
    const tipoDocRepo = AppDataSource.getRepository(TipoDocumento);
    let docNit = await tipoDocRepo.findOne({ where: { abreviatura: 'NIT' } });
    if (!docNit) {
      docNit = await tipoDocRepo.save(
        tipoDocRepo.create({
          id: '6',
          abreviatura: 'NIT',
          nombre: 'NIT',
          state: true,
        })
      );
    }
    let docCC = await tipoDocRepo.findOne({ where: { abreviatura: 'CC' } });
    if (!docCC) {
      docCC = await tipoDocRepo.save(
        tipoDocRepo.create({
          id: '3',
          abreviatura: 'CC',
          nombre: 'Cédula de ciudadanía',
          state: true,
        })
      );
    }
    const tipoDocNitId = Number(docNit.id);
    const tipoDocCCId = Number(docCC.id);

    // Validar o crear Canal de Venta
    const canalVentaRepo = AppDataSource.getRepository(CanalVenta);
    let canalVenta = await canalVentaRepo.findOne({ where: { state: true } });
    if (!canalVenta) {
      canalVenta = await canalVentaRepo.save(
        canalVentaRepo.create({
          id: '1',
          codigo: 'DIR',
          nombre: 'Venta Directa',
          state: true,
        })
      );
    }
    const canalVentaId = Number(canalVenta.id);

    // Validar o crear Método de Pago Efectivo (código 10)
    const metodoPagoRepo = AppDataSource.getRepository(MetodoPago);
    let metodoPago = await metodoPagoRepo.findOne({ where: { codigo: '10' } });
    if (!metodoPago) {
      metodoPago = await metodoPagoRepo.save(
        metodoPagoRepo.create({
          codigo: '10',
          nombre: 'Efectivo',
          state: true,
        })
      );
    }

    // ----------------------------------------------------
    // 3. EMPRESA DEMO
    // ----------------------------------------------------
    console.log('\n🏢 [1/5] Configurando Empresa Demo...');
    const empresaRepo = AppDataSource.getRepository(Empresa);
    let empresa = await empresaRepo.findOne({ where: { nit: '901234567-8' } });

    if (!empresa) {
      empresa = empresaRepo.create({
        nit: '901234567-8',
        razonSocial: 'Empresa Demo Colombia S.A.S.',
        direccion: 'Calle 100 # 15-20, Piso 5, Bogotá D.C.',
        telefono: '6013001234',
        email: 'contacto@democolombia.com',
        ciudad: ciudadId,
      });
      empresa = await empresaRepo.save(empresa);
      console.log(`   ✔ Empresa creada: ${empresa.razonSocial} (NIT: ${empresa.nit})`);
    } else {
      console.log(`   ✔ Empresa existente: ${empresa.razonSocial}`);
    }

    // ----------------------------------------------------
    // 4. USUARIO ADMINISTRADOR DEMO
    // ----------------------------------------------------
    console.log('\n👤 [2/5] Configurando Usuario Administrador...');
    const userRepo = AppDataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { email: 'admin@demo.com' } });
    const hashedPassword = await bcryptjs.hash('Demo1234*', 10);

    if (!adminUser) {
      adminUser = userRepo.create({
        fullName: 'Administrador Demo',
        email: 'admin@demo.com',
        password: hashedPassword,
        phone: '3001234567',
        isActive: true,
        role: adminRole,
        roleId: adminRole.id,
        empresa: empresa,
        empresaId: empresa.id,
      });
      adminUser = await userRepo.save(adminUser);
      console.log(`   ✔ Usuario creado: ${adminUser.email}`);
    } else {
      adminUser.password = hashedPassword;
      adminUser.empresaId = empresa.id;
      adminUser.roleId = adminRole.id;
      await userRepo.save(adminUser);
      console.log(`   ✔ Usuario actualizado: ${adminUser.email}`);
    }

    // Vincular en user_empresas
    const userEmpresaRepo = AppDataSource.getRepository(UserEmpresa);
    const userEmpresaExists = await userEmpresaRepo.findOne({
      where: { userId: adminUser.id, empresaId: empresa.id }
    });
    if (!userEmpresaExists) {
      await userEmpresaRepo.save(
        userEmpresaRepo.create({
          userId: adminUser.id,
          empresaId: empresa.id,
          isDefault: true,
        })
      );
    }

    // ----------------------------------------------------
    // 5. CLIENTES Y PROVEEDORES (TERCEROS)
    // ----------------------------------------------------
    console.log('\n👥 [3/5] Creando Terceros (5 Clientes y 5 Proveedores)...');
    const clienteRepo = AppDataSource.getRepository(Cliente);
    const proveedorRepo = AppDataSource.getRepository(Proveedor);

    const clientesData = [
      {
        nombre: 'Distribuidora Andina',
        apellido: 'S.A.S.',
        razonSocial: 'Distribuidora Andina S.A.S.',
        tipoDocumento: tipoDocNitId,
        numeroDocumento: '900888111',
        dv: '1',
        tipoPersona: '2', // Jurídica
        direccion: 'Carrera 7 # 72-10, Oficina 402',
        ciudad: ciudadId,
        telefono: '6013214567',
        email: 'ventas@distribuidoraandina.com',
        observacion: 'Cliente mayorista principal',
        tributo: 18,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Tecnología Global',
        apellido: 'Ltda.',
        razonSocial: 'Tecnología Global Ltda.',
        tipoDocumento: tipoDocNitId,
        numeroDocumento: '900777222',
        dv: '2',
        tipoPersona: '2',
        direccion: 'Calle 10 # 43E-12, Medellín',
        ciudad: ciudadId,
        telefono: '6044445566',
        email: 'compras@tecnglobal.com',
        observacion: 'Cliente corporativo de equipos',
        tributo: 18,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Comercializadora El Sol',
        apellido: '',
        razonSocial: 'Comercializadora El Sol S.A.',
        tipoDocumento: tipoDocNitId,
        numeroDocumento: '900666333',
        dv: '3',
        tipoPersona: '2',
        direccion: 'Avenida 6N # 28-30, Cali',
        ciudad: ciudadId,
        telefono: '6026678899',
        email: 'contacto@comercialsolsa.com',
        observacion: 'Cadena de almacenes',
        tributo: 18,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Inversiones Bogotá',
        apellido: 'S.A.',
        razonSocial: 'Inversiones Bogotá S.A.',
        tipoDocumento: tipoDocNitId,
        numeroDocumento: '900555444',
        dv: '4',
        tipoPersona: '2',
        direccion: 'Carrera 15 # 93-45',
        ciudad: ciudadId,
        telefono: '6017458900',
        email: 'facturacion@inversionesbogota.co',
        observacion: 'Cliente financiero e inversiones',
        tributo: 18,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Carlos Andrés',
        apellido: 'Gómez Restrepo',
        razonSocial: 'Carlos Andrés Gómez',
        tipoDocumento: tipoDocCCId,
        numeroDocumento: '1020304050',
        dv: '',
        tipoPersona: '1', // Natural
        direccion: 'Calle 53 # 24-18',
        ciudad: ciudadId,
        telefono: '3157894561',
        email: 'carlos.gomez@gmail.com',
        observacion: 'Cliente independiente',
        tributo: 21,
        empresaId: empresa.id,
        isActive: true,
      },
    ];

    const seededClientes: Cliente[] = [];
    for (const data of clientesData) {
      let cl = await clienteRepo.findOne({
        where: { numeroDocumento: data.numeroDocumento, empresaId: empresa.id },
      });
      if (!cl) {
        cl = await clienteRepo.save(clienteRepo.create(data));
      }
      seededClientes.push(cl);
    }
    console.log(`   ✔ ${seededClientes.length} Clientes verificados/creados.`);

    const proveedoresData = [
      {
        nombre: 'Mayorista Textil de Colombia',
        razonSocial: 'Mayorista Textil de Colombia S.A.S.',
        tipoDocumento: tipoDocNitId,
        identificacion: '900111999',
        dv: '9',
        tipoPersona: '2',
        email: 'ventas@mayoristatextil.co',
        telefono: '6012223344',
        direccion: 'Zona Industrial Montevideo, Bogotá',
        ciudad: ciudadId,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Importaciones Asia-América',
        razonSocial: 'Importaciones Asia-América Ltda.',
        tipoDocumento: tipoDocNitId,
        identificacion: '900222888',
        dv: '8',
        tipoPersona: '2',
        email: 'pedidos@asiamerica.com',
        telefono: '6015551122',
        direccion: 'Calle 13 # 68-90, Bogotá',
        ciudad: ciudadId,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Papelería & Suministros Nacional',
        razonSocial: 'Papelería & Suministros Nacional S.A.S.',
        tipoDocumento: tipoDocNitId,
        identificacion: '900333777',
        dv: '7',
        tipoPersona: '2',
        email: 'corporativo@papelerianacional.com',
        telefono: '6014443322',
        direccion: 'Carrera 30 # 45-12, Bogotá',
        ciudad: ciudadId,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Servicios Cloud Colombia',
        razonSocial: 'Servicios Cloud Colombia S.A.',
        tipoDocumento: tipoDocNitId,
        identificacion: '900444666',
        dv: '6',
        tipoPersona: '2',
        email: 'billing@cloudcolombia.com',
        telefono: '6018889900',
        direccion: 'Calle 100 # 8A-49, Bogotá',
        ciudad: ciudadId,
        empresaId: empresa.id,
        isActive: true,
      },
      {
        nombre: 'Empaque y Logística del Valle',
        razonSocial: 'Empaque y Logística del Valle S.A.S.',
        tipoDocumento: tipoDocNitId,
        identificacion: '900555555',
        dv: '5',
        tipoPersona: '2',
        email: 'ventas@empaquesvalle.com',
        telefono: '6028890011',
        direccion: 'Yumbo, Valle del Cauca',
        ciudad: ciudadId,
        empresaId: empresa.id,
        isActive: true,
      },
    ];

    const seededProveedores: Proveedor[] = [];
    for (const data of proveedoresData) {
      let pr = await proveedorRepo.findOne({
        where: { identificacion: data.identificacion, empresaId: empresa.id },
      });
      if (!pr) {
        pr = await proveedorRepo.save(proveedorRepo.create(data));
      }
      seededProveedores.push(pr);
    }
    console.log(`   ✔ ${seededProveedores.length} Proveedores verificados/creados.`);

    // ----------------------------------------------------
    // 6. CATÁLOGO DE ARTÍCULOS E INVENTARIO (KARDEX)
    // ----------------------------------------------------
    console.log('\n📦 [4/5] Creando 12 Artículos y Stock inicial en Kardex...');
    const articuloRepo = AppDataSource.getRepository(Articulo);
    const movInvRepo = AppDataSource.getRepository(MovimientoInventario);

    const categoriaProductoId = catProducto ? catProducto.id : '1';
    const categoriaServicioId = catServicio ? catServicio.id : '2';
    const unidadMedidaId = unidadDefecto ? unidadDefecto.id : '70';
    const impuesto19Id = iva19 ? iva19.id : '';
    const impuesto5Id = iva5 ? iva5.id : '';
    const impuestoExentoId = ivaExento ? ivaExento.id : '';

    const articulosData = [
      {
        codigo: 'ART-001',
        nombre: 'Laptop Dell Inspiron 15 (Core i5, 16GB, 512GB SSD)',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Tecnología',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 2850000,
        precioventa2: 2750000,
        isInventariable: true,
        stock: 25,
      },
      {
        codigo: 'ART-002',
        nombre: 'Monitor Samsung 24" Full HD IPS 75Hz',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Tecnología',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 580000,
        precioventa2: 540000,
        isInventariable: true,
        stock: 40,
      },
      {
        codigo: 'ART-003',
        nombre: 'Combo Teclado y Mouse Inalámbrico Logitech MK270',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Accesorios',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 125000,
        precioventa2: 115000,
        isInventariable: true,
        stock: 60,
      },
      {
        codigo: 'ART-004',
        nombre: 'Resma Papel Carta Reprograf 75g (500 hojas)',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Papelería',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 18500,
        precioventa2: 17000,
        isInventariable: true,
        stock: 200,
      },
      {
        codigo: 'ART-005',
        nombre: 'Silla Ergonómica Ejecutiva Oficina con Apoyacabezas',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Muebles',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 450000,
        precioventa2: 420000,
        isInventariable: true,
        stock: 18,
      },
      {
        codigo: 'ART-006',
        nombre: 'Disco Solido Kingston NV2 1TB PCIe 4.0 M.2',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Componentes',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 295000,
        precioventa2: 280000,
        isInventariable: true,
        stock: 35,
      },
      {
        codigo: 'ART-007',
        nombre: 'Memoria USB Kingston Exodia 64GB USB 3.2',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Almacenamiento',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 28000,
        precioventa2: 25000,
        isInventariable: true,
        stock: 150,
      },
      {
        codigo: 'ART-008',
        nombre: 'Café Grano Especial Colombiano Huila (500g)',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Alimentos',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto5Id || impuesto19Id,
        porcentajeIva: 5,
        precio: 32000,
        precioventa2: 29000,
        isInventariable: true,
        stock: 80,
      },
      {
        codigo: 'ART-009',
        nombre: 'Cuaderno Argollado Ejecutivo Tapa Dura 100 Hojas',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Papelería',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuestoExentoId || impuesto19Id,
        porcentajeIva: 0,
        precio: 14000,
        precioventa2: 12500,
        isInventariable: true,
        stock: 120,
      },
      {
        codigo: 'ART-010',
        nombre: 'Auriculares Inalámbricos Bluetooth con Cancelación de Ruido',
        tipo: ArticuloTipo.VENTA,
        fullNameCategoria: 'Productos / Audio',
        categoriaArticuloId: categoriaProductoId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 180000,
        precioventa2: 165000,
        isInventariable: true,
        stock: 50,
      },
      {
        codigo: 'SRV-001',
        nombre: 'Mantenimiento Preventivo y Correctivo de Cómputo',
        tipo: ArticuloTipo.SERVICIO,
        fullNameCategoria: 'Servicios / Soporte Técnico',
        categoriaArticuloId: categoriaServicioId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 95000,
        precioventa2: 85000,
        isInventariable: false,
        stock: 0,
      },
      {
        codigo: 'SRV-002',
        nombre: 'Consultoría y Asesoría Contable Mensual Pymes',
        tipo: ArticuloTipo.SERVICIO,
        fullNameCategoria: 'Servicios / Profesionales',
        categoriaArticuloId: categoriaServicioId,
        unidadmedida: unidadMedidaId,
        impuestoIdStr: impuesto19Id,
        porcentajeIva: 19,
        precio: 650000,
        precioventa2: 600000,
        isInventariable: false,
        stock: 0,
      },
    ];

    const seededArticulos: Articulo[] = [];
    for (const item of articulosData) {
      let art = await articuloRepo.findOne({
        where: { codigo: item.codigo, empresaId: empresa.id }
      });

      if (!art) {
        art = articuloRepo.create({
          codigo: item.codigo,
          nombre: item.nombre,
          tipo: item.tipo,
          fullNameCategoria: item.fullNameCategoria,
          categoriaArticuloId: item.categoriaArticuloId,
          unidadmedida: item.unidadmedida,
          impuestoId: item.impuestoIdStr,
          porcentajeIva: item.porcentajeIva,
          precio: item.precio,
          precioventa2: item.precioventa2,
          isInventariable: item.isInventariable,
          stock: item.stock,
          empresaId: empresa.id,
          createdById: adminUser.id,
          isActive: true,
        });
        art = await articuloRepo.save(art);

        // Registro de Kardex
        if (art.isInventariable && art.stock > 0) {
          await movInvRepo.save(
            movInvRepo.create({
              articuloId: art.id,
              empresaId: empresa.id,
              tipo: TipoMovimientoInventario.ENTRADA,
              cantidad: art.stock,
              saldoDespues: art.stock,
              documentoTipo: DocumentoInventario.AJUSTE_MANUAL,
              documentoId: 'INICIAL-DEMO',
              motivo: 'Inventario inicial de apertura - Entorno Demo',
              createdById: adminUser.id,
            })
          );
        }
      }
      seededArticulos.push(art);
    }
    console.log(`   ✔ ${seededArticulos.length} Artículos verificados con stock y kardex inicial.`);

    // ----------------------------------------------------
    // 7. FACTURAS DE VENTA (Pagada, Pendiente, Vencida)
    // ----------------------------------------------------
    console.log('\n🧾 [5/5] Creando Facturas de Venta y Compra...');
    const facturaVentaRepo = AppDataSource.getRepository(FacturasVenta);
    const itemVentaRepo = AppDataSource.getRepository(ItemsFacturaVenta);

    const facturasVentaConfig = [
      {
        comprobante: '1001',
        comprobante_completo: 'FV-1001',
        prefijo: 'FV',
        cliente: seededClientes[0],
        formaPago: FormaPago.CONTADO,
        paymentStatus: PaymentStatus.PAID,
        fecha: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        articulos: [
          { art: seededArticulos[0], cantidad: 1 },
          { art: seededArticulos[2], cantidad: 2 },
        ],
      },
      {
        comprobante: '1002',
        comprobante_completo: 'FV-1002',
        prefijo: 'FV',
        cliente: seededClientes[1],
        formaPago: FormaPago.CREDITO,
        paymentStatus: PaymentStatus.PENDING,
        fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        fechaVencimiento: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        articulos: [
          { art: seededArticulos[1], cantidad: 3 },
          { art: seededArticulos[5], cantidad: 2 },
        ],
      },
      {
        comprobante: '1003',
        comprobante_completo: 'FV-1003',
        prefijo: 'FV',
        cliente: seededClientes[2],
        formaPago: FormaPago.CREDITO,
        paymentStatus: PaymentStatus.PENDING,
        fecha: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        fechaVencimiento: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        articulos: [
          { art: seededArticulos[3], cantidad: 20 },
          { art: seededArticulos[6], cantidad: 10 },
        ],
      },
    ];

    for (const fv of facturasVentaConfig) {
      const exists = await facturaVentaRepo.findOne({
        where: { comprobante_completo: fv.comprobante_completo, empresaId: empresa.id },
      });

      if (!exists) {
        let subtotal = 0;
        let ivaTotal = 0;

        for (const item of fv.articulos) {
          const itemSubtotal = item.art.precio * item.cantidad;
          const itemIva = (itemSubtotal * (item.art.porcentajeIva || 19)) / 100;
          subtotal += itemSubtotal;
          ivaTotal += itemIva;
        }

        const total = subtotal + ivaTotal;
        const totalPagado = fv.paymentStatus === PaymentStatus.PAID ? total : 0;
        const saldoPendiente = total - totalPagado;

        const nuevaFactura = facturaVentaRepo.create({
          tipoFactura: TipoFactura.STANDARD,
          prefijo: fv.prefijo,
          comprobante: fv.comprobante,
          comprobante_completo: fv.comprobante_completo,
          status: InvoiceStatus.ISSUED,
          dianStatus: DianStatus.ACCEPTED,
          formaPago: fv.formaPago,
          metodoPago: metodoPago.codigo,
          canalVenta: canalVentaId,
          fecha: fv.fecha,
          fechaVencimiento: fv.fechaVencimiento,
          clientId: fv.cliente.id,
          client: fv.cliente,
          empresaId: empresa.id,
          subtotal,
          iva: ivaTotal,
          descuento: 0,
          total,
          totalPagado,
          saldoPendiente,
          paymentStatus: fv.paymentStatus,
          createdById: adminUser.id,
        });

        const savedFactura = await facturaVentaRepo.save(nuevaFactura);

        for (const item of fv.articulos) {
          const itemSub = item.art.precio * item.cantidad;
          const itemIv = (itemSub * (item.art.porcentajeIva || 19)) / 100;

          await itemVentaRepo.save(
            itemVentaRepo.create({
              facturaId: savedFactura.id,
              articuloId: item.art.id,
              articulo: item.art,
              quantity: item.cantidad,
              unitPrice: item.art.precio,
              iva: item.art.porcentajeIva || 19,
              valor_iva: itemIv,
              discount: 0,
              valor_discount: 0,
              subtotal: itemSub,
              importe: itemSub,
              total: itemSub + itemIv,
              description: item.art.nombre,
            })
          );
        }
      }
    }
    console.log('   ✔ Facturas de venta creadas (1 Pagada, 1 Pendiente, 1 Vencida).');

    // Facturas de Compra (1 Pagada, 1 Pendiente)
    const facturaCompraRepo = AppDataSource.getRepository(FacturaCompra);
    const itemCompraRepo = AppDataSource.getRepository(FacturaCompraDetalle);

    const facturasCompraConfig = [
      {
        numero: 'FC-501',
        numeroFacturaProveedor: 'FAC-PROV-9874',
        proveedor: seededProveedores[0],
        formaPago: FormaPago.CONTADO,
        paymentStatus: PaymentStatus.PAID,
        fecha: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        fechaVencimiento: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        items: [
          { art: seededArticulos[3], cantidad: 50, costo: 12000 },
        ],
      },
      {
        numero: 'FC-502',
        numeroFacturaProveedor: 'FAC-PROV-1123',
        proveedor: seededProveedores[1],
        formaPago: FormaPago.CREDITO,
        paymentStatus: PaymentStatus.PENDING,
        fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        fechaVencimiento: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
        items: [
          { art: seededArticulos[1], cantidad: 5, costo: 420000 },
        ],
      },
    ];

    for (const fc of facturasCompraConfig) {
      const exists = await facturaCompraRepo.findOne({
        where: { numero: fc.numero, empresaId: empresa.id },
      });

      if (!exists) {
        let subtotal = 0;
        let iva = 0;
        for (const it of fc.items) {
          const s = it.costo * it.cantidad;
          subtotal += s;
          iva += (s * 0.19);
        }
        const total = subtotal + iva;
        const totalPagado = fc.paymentStatus === PaymentStatus.PAID ? total : 0;
        const saldoPendiente = total - totalPagado;

        const nuevaCompra = await facturaCompraRepo.save(
          facturaCompraRepo.create({
            numero: fc.numero,
            numeroFacturaProveedor: fc.numeroFacturaProveedor,
            proveedorId: fc.proveedor.id,
            formaPago: fc.formaPago,
            paymentStatus: fc.paymentStatus,
            estado: GastoEstado.REGISTRADO,
            fecha: fc.fecha,
            fechaVencimiento: fc.fechaVencimiento,
            empresaId: empresa.id,
            subtotal,
            iva,
            descuento: 0,
            total,
            totalPagado,
            saldoPendiente,
            observaciones: 'Compra de inventario de prueba - Entorno Demo',
            createdById: adminUser.id,
          })
        );

        for (const it of fc.items) {
          const s = it.costo * it.cantidad;
          await itemCompraRepo.save(
            itemCompraRepo.create({
              facturaCompraId: nuevaCompra.id,
              articuloId: it.art.id,
              articulo: it.art,
              quantity: it.cantidad,
              unitPrice: it.costo,
              porcentajeIva: 19,
              valorIva: s * 0.19,
              descuento: 0,
              valorDescuento: 0,
              valorSubtotal: s,
              itemTotal: s * 1.19,
              descripcion: it.art.nombre,
            })
          );
        }
      }
    }
    console.log('   ✔ Facturas de compra creadas (1 Pagada, 1 Pendiente).');

    // ----------------------------------------------------
    // RESUMEN FINAL
    // ----------------------------------------------------
    console.log('\n========================================================');
    console.log('🚀 ¡SEED DE DEMOSTRACIÓN COMPLETADO CON ÉXITO!');
    console.log('========================================================');
    console.log('🏢 Empresa:   Empresa Demo Colombia S.A.S. (NIT: 901234567-8)');
    console.log('👤 Usuario:   admin@demo.com');
    console.log('🔑 Clave:     Demo1234*');
    console.log('👥 Terceros:  5 Clientes y 5 Proveedores creados');
    console.log('📦 Productos: 12 Artículos con stock y movimientos de Kardex');
    console.log('🧾 Facturas:  Ventas y Compras (Pagadas, Pendientes y Vencidas)');
    console.log('ℹ️  Nota:      El PUC lo gestiona y sincroniza AppModule al iniciar.');
    console.log('========================================================\n');

  } catch (error) {
    console.error('❌ Error ejecutando el seed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔌 Conexión cerrada.');
    }
  }
}

runSeed();
