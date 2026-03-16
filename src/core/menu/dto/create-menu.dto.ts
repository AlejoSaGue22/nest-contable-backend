import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Max, Min, ValidateIf } from "class-validator";
import { Permission } from "src/common/constants/roles.constants";

export class CreateMenuDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  icon: string;

  @IsOptional()
  @IsString()
  @ValidateIf(o => !o.externalUrl)
  route?: string;

  @IsOptional()
  @IsUrl()
  @ValidateIf(o => !o.route)
  externalUrl?: string;

  @IsOptional()
  @IsEnum(Permission)
  requiredPermission?: Permission;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  order: number = 0;

  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;

  @IsOptional()
  @IsBoolean()
  isVisible: boolean = true;

//   @IsOptional()
//   @Type(() => Object)
//   metadata?: Record<string, any>;
}
