import { PartialType } from "@nestjs/mapped-types";
import { CreateNotaAjusteSoporteDto } from "./create-nota-ajuste-soporte.dto";

export class UpdateNotaAjusteSoporteDto extends PartialType(CreateNotaAjusteSoporteDto) { }
