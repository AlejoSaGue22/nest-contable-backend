import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Permission } from "src/common/constants/roles.constants";

export class CreateRoleDto {
@IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Transform(({ value }) => value.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(200)
  description: string;

  @IsArray()
  @ArrayNotEmpty()
  // @IsEnum(Permission, { each: true })
  permissions: Permission[];

  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;
}
