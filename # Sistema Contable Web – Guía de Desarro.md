
# Sistema Contable Web – Guía de Desarrollo Completa

## 1. Objetivo del sistema

Construir un **sistema web contable y financiero** que permita a una persona o empresa:

* Registrar **ingresos y gastos**
* Emitir **facturas de venta** (incluyendo electrónicas)
* Registrar **compras y gastos operativos**
* Obtener **resultados financieros** (ganancias/pérdidas)
* Mantener **trazabilidad contable real**

Stack:

* **Frontend:** Angular
* **Backend:** NestJS
* **DB:** PostgreSQL / MySQL / Oracle

---

## 2. Flujo general del sistema (visión macro)

```
Configuración inicial
   ↓
Catálogos base (una sola vez)
   ↓
Operaciones diarias
   ↓
Procesos contables automáticos
   ↓
Reportes financieros
```

---

## 3. Módulos principales del sistema

### 3.1 Configuración (Setup inicial)

Este módulo se ejecuta **antes de operar**.

* Empresa
* Usuarios y roles
* Plan de cuentas contables
* Impuestos
* Artículos (ventas y compras)
* Clientes
* Proveedores

👉 Sin esto, **no se puede facturar**.

---

## 4. Flujo operativo REAL (día a día)

### 4.1 Factura de venta

```
Cliente
   ↓
Selecciona artículos de venta
   ↓
Sistema calcula impuestos
   ↓
Se guarda factura
   ↓
Se genera asiento contable
   ↓  
Actualiza ingresos
```

**Resultado contable:**

* Aumenta ingresos
* Aumenta cuentas por cobrar o caja

---

### 4.2 Factura de venta electrónica

```
Factura validada
   ↓
Generar XML/JSON
   ↓
Enviar a proveedor electrónico
   ↓
Respuesta (aprobada / rechazada)
   ↓
Guardar estado fiscal
```

---

### 4.3 Registro de gasto

```
Proveedor
   ↓
Selecciona artículo de gasto
   ↓
Sistema usa cuenta contable
   ↓
Se registra gasto
   ↓
Se genera asiento
```

**Resultado contable:**

* Aumenta gastos
* Disminuye caja o genera cuentas por pagar

---

## 5. Lógica contable automática (clave del sistema)

⚠️ **El usuario NO elige cuentas contables en documentos**

Todo sale desde:

* Artículos
* Impuestos

Ejemplo:

* Artículo: Papelería
* Cuenta: 5105
* IVA: 2408

Al usarlo → el sistema **sabe qué asiento generar**.

---

## 6. Modelo de base de datos (núcleo)

### 6.1 Usuarios y empresa

```sql
EMPRESA(id, nombre, nit, moneda)
USUARIO(id, empresa_id, nombre, email, rol)
```

---

### 6.2 Plan de cuentas

```sql
CUENTA_CONTABLE(
  id,
  codigo,
  nombre,
  tipo, -- ACTIVO, PASIVO, INGRESO, GASTO
  naturaleza -- DEBITO / CREDITO
)
```

---

### 6.3 Artículos (ventas / compras)

```sql
ARTICULO(
  id,
  codigo,
  nombre,
  tipo, -- VENTA, GASTO, INVENTARIO
  cuenta_contable_id,
  cuenta_iva_id,
  afecta_inventario BOOLEAN,
  estado
)
```

👉 **Este es el corazón del sistema**

---

### 6.4 Clientes y proveedores

```sql
CLIENTE(id, nombre, documento, email)
PROVEEDOR(id, nombre, documento, email)
```

---

### 6.5 Facturas de venta

```sql
FACTURA_VENTA(
  id,
  cliente_id,
  fecha,
  total,
  estado
)

FACTURA_VENTA_DETALLE(
  id,
  factura_id,
  articulo_id,
  cantidad,
  precio,
  impuesto
)
```

---

### 6.6 Gastos

```sql
GASTO(
  id,
  proveedor_id,
  fecha,
  total
)

GASTO_DETALLE(
  id,
  gasto_id,
  articulo_id,
  valor
)
```

---

### 6.7 Contabilidad (asientos)

```sql
ASIENTO(
  id,
  fecha,
  referencia,
  tipo
)

ASIENTO_DETALLE(
  id,
  asiento_id,
  cuenta_id,
  debito,
  credito
)
```

---

## 7. Flujo de generación de asientos

### Factura de venta

```
Caja / CxC      D
   Ingresos          C
   IVA por pagar     C
```

### Gasto

```
Gasto            D
IVA crédito      D
   Caja / CxP        C
```

---

## 8. Reportes financieros

### Estado de resultados

```
Ingresos
- Costos
----------------
Utilidad bruta
- Gastos
----------------
Utilidad neta
```

### Flujo de caja

* Entradas
* Salidas

--- 

## 9. Arquitectura NestJS sugerida

```
modules/
  auth/
  users/
  company/
  accounts/
  articles/
  invoices/
  expenses/
  accounting/
  reports/
```

Cada módulo:

* controller
* service
* entity
* dto

---

## 10. Flujo Angular recomendado

```
/login
/dashboard
/configuracion
/compras
/ventas
/gastos
/reportes
```

---

## 11. Roadmap para terminar el sistema

1️⃣ Plan de cuentas + artículos
2️⃣ Clientes / proveedores
3️⃣ Factura de venta normal
4️⃣ Asientos automáticos
5️⃣ Registro de gastos
6️⃣ Reportes financieros
7️⃣ Facturación electrónica

---

## 12. Regla de oro

> **Si un sistema contable no genera asientos automáticos, NO es contable**

---

Si quieres, en el siguiente paso puedo:

* Diseñarte los **DTOs NestJS**
* Crear los **servicios de asientos automáticos**
* Mostrar el **flujo exacto Angular → API → DB**
* Armar el **checklist para producción**

---

# 13. Diseño técnico – NestJS + Angular (implementación real)

## 13.1 ¿Dónde vive la CUENTA CONTABLE?

✅ **En NestJS, módulo independiente**

```
src/modules/accounts/
  account.entity.ts
  account.controller.ts
  account.service.ts
  dto/
```

👉 Es **transversal**: la usan artículos, impuestos y asientos.

---

## 14. ENTITIES NestJS (TypeORM)

### 14.1 Cuenta contable

```ts
@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // 1105, 4135, 5105

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ['ACTIVO','PASIVO','INGRESO','GASTO','PATRIMONIO'] })
  type: string;

  @Column({ type: 'enum', enum: ['DEBITO','CREDITO'] })
  nature: string;
}
```

---

### 14.2 Artículo

```ts
@Entity('articles')
export class ArticleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ['VENTA','GASTO','INVENTARIO'] })
  type: string;

  @ManyToOne(() => AccountEntity)
  account: AccountEntity;

  @ManyToOne(() => AccountEntity, { nullable: true })
  ivaAccount?: AccountEntity;

  @Column({ default: true })
  allowsIva: boolean;
}
```

---

### 14.3 Impuesto

```ts
@Entity('taxes')
export class TaxEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // IVA 19%

  @Column('decimal')
  rate: number; // 0.19

  @ManyToOne(() => AccountEntity)
  account: AccountEntity;

  @Column({ type: 'enum', enum: ['IVA','RETENCION'] })
  type: string;
}
```

---

### 14.4 Factura de venta

```ts
@Entity('sales_invoices')
export class SalesInvoiceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: Date;

  @ManyToOne(() => ClientEntity)
  client: ClientEntity;

  @OneToMany(() => SalesInvoiceDetailEntity, d => d.invoice, { cascade: true })
  details: SalesInvoiceDetailEntity[];

  @Column('decimal')
  total: number;
}
```

---

### 14.5 Asientos contables

```ts
@Entity('journal_entries')
export class JournalEntryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: Date;

  @Column()
  reference: string; // FACT-001

  @OneToMany(() => JournalEntryLineEntity, l => l.entry, { cascade: true })
  lines: JournalEntryLineEntity[];
}
```

```ts
@Entity('journal_entry_lines')
export class JournalEntryLineEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => JournalEntryEntity, e => e.lines)
  entry: JournalEntryEntity;

  @ManyToOne(() => AccountEntity)
  account: AccountEntity;

  @Column('decimal', { default: 0 })
  debit: number;

  @Column('decimal', { default: 0 })
  credit: number;
}
```

---

## 15. DTOs NestJS

### 15.1 Crear factura

```ts
export class CreateSalesInvoiceDto {
  clientId: number;
  date: Date;
  details: {
    articleId: number;
    quantity: number;
    price: number;
    taxIds: number[];
  }[];
}
```

---

## 16. Servicio de generación automática de asientos

```ts
@Injectable()
export class AccountingService {
  async createInvoiceEntry(invoice: SalesInvoiceEntity) {
    const entry = new JournalEntryEntity();
    entry.date = invoice.date;
    entry.reference = `FACT-${invoice.id}`;
    entry.lines = [];

    let totalDebit = 0;

    for (const d of invoice.details) {
      const base = d.price * d.quantity;

      // INGRESO
      entry.lines.push({
        account: d.article.account,
        debit: 0,
        credit: base,
      } as any);

      totalDebit += base;

      // IVA
      for (const tax of d.taxes) {
        if (tax.type === 'IVA') {
          const iva = base * tax.rate;
          entry.lines.push({
            account: tax.account,
            debit: 0,
            credit: iva,
          } as any);
          totalDebit += iva;
        }
      }
    }

    // CAJA / CXC
    entry.lines.push({
      account: await this.cashAccount(),
      debit: totalDebit,
      credit: 0,
    } as any);

    return this.entryRepo.save(entry);
  }
}
```

---

## 17. Interfaces Angular

### 17.1 Artículo

```ts
export interface Article {
  id: number;
  code: string;
  name: string;
  type: 'VENTA' | 'GASTO';
  allowsIva: boolean;
}
```

---

### 17.2 Factura

```ts
export interface SalesInvoiceCreate {
  clientId: number;
  date: string;
  details: SalesInvoiceDetail[];
}

export interface SalesInvoiceDetail {
  articleId: number;
  quantity: number;
  price: number;
  taxIds: number[];
}
```

---

## 18. Flujo Angular → API → Asiento

```
Formulario Angular
   ↓
POST /sales-invoices
   ↓
FacturaService
   ↓
AccountingService
   ↓
Asiento contable
```

---

## 19. Validaciones fiscales reales

### IVA

* Solo si artículo lo permite
* Tasa configurable
* Cuenta contable obligatoria

### Retenciones

* Aplican solo si proveedor/cliente lo requiere
* Reducen pago, no el gasto

---

## 20. Regla de implementación

> ❌ NO generar asientos en el controller
> ✅ Siempre en servicios

---

👉 Siguiente paso recomendado:

1️⃣ Registro de gastos con asientos
2️⃣ Estado de resultados automático
3️⃣ Facturación electrónica



🎯 Características Clave:
✅ El usuario NUNCA elige cuentas contables - Todo está pre-configurado en los artículos
✅ Generación automática de asientos - Sin intervención manual
✅ Reportes en tiempo real - Calculados desde los asientos contables
✅ Sistema de permisos robusto - Ya integrado con tus guards
✅ Validaciones completas - Prevención de errores contables
🚀 Próximos Pasos Recomendados:

1. Implementar el frontend Angular con los formularios
2. Agregar facturación electrónica DIAN
3. Crear exportación de reportes a PDF/Excel
4. Agregar dashboard con gráficos

¿Necesitas que desarrolle algún componente específico del frontend Angular o que profundice en alguna funcionalidad particular?
