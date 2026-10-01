const fs = require('fs');
let c = fs.readFileSync('src/nomina/nomina.service.ts', 'utf8');
c = c.replace('configContable?.cajaBanco?.cuentaObligacionesLabId', 'configContable?.configuracion?.cajaBanco?.cuentaObligacionesLabId');
c = c.replace(/netoPagarPagar/g, 'netoPagar');
if (!c.includes('MoreThan')) {
    c = "import { MoreThan } from 'typeorm';\n" + c;
}
fs.writeFileSync('src/nomina/nomina.service.ts', c);
