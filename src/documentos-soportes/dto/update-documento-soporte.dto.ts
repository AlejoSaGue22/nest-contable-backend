import { PartialType } from "@nestjs/mapped-types";
import { CreateDocumentoSoporteDto } from "./create-documento-soporte.dto";

export class UpdateDocumentoSoporteDto extends PartialType(CreateDocumentoSoporteDto) { }
