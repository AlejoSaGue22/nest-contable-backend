const fs = require('fs');
const path = 'C:\\laragon\\www\\Course_Angular_2025\\Contable\\nest_contable\\nest-contable-backend\\src\\nomina\\nomina.controller.ts';
let c = fs.readFileSync(path, 'utf8');

const newRoute = 
  @Get('obligaciones')
  findAllObligaciones(@Query() query: any) {
    return this.nominaService.findAllObligaciones(query);
  }

  @Post('periodos');

c = c.replace("@Post('periodos')", newRoute);
if(!c.includes('findAllObligaciones')) {
   c = c.replace("@Post('periodos/:id/pagar')", newRoute + "\n\n  @Post('periodos/:id/pagar')"); // backup replace
}
fs.writeFileSync(path, c, 'utf8');
