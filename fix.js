const fs = require('fs');
let c = fs.readFileSync('src/nomina/nomina.service.ts', 'utf8');
c = c.replace('this.configContableRepo', 'this.configuracionContableRepo');
c = c.replace('const detallesContables = [];', 'const detallesContables: any[] = [];');
c = c.replace('import { Repository, In, QueryRunner } from \\'typeorm\\';', 'import { Repository, In, QueryRunner, MoreThan } from \\'typeorm\\';');
c = c.replace(/l\.neto/g, 'l.netoPagar');
fs.writeFileSync('src/nomina/nomina.service.ts', c);
