import { Controller, Get, Put, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { EmpresaService } from './empresa.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Controller('settings/empresa')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Get()
  getEmpresa() {
    return this.empresaService.getEmpresa();
  }

  @Put()
  update(@Body() updateEmpresaDto: UpdateEmpresaDto) {
    return this.empresaService.update(updateEmpresaDto);
  }

  @Post('upload-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/company';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(new BadRequestException('Solo se permiten archivos de imagen (jpg, png, webp, svg)'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadLogo(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }
    const logoUrl = `/uploads/company/${file.filename}`;
    return { success: true, logoUrl, message: 'Logo subido correctamente' };
  }
}
