import { IsEmail, IsString, IsUUID, MaxLength, MinLength, IsOptional, IsBoolean } from "class-validator";

export class CreateUserDto {

    @IsEmail()
    @IsString()
    email: string

    @IsString()
    @MinLength(4)
    @MaxLength(50)
    password: string;

    @IsString()
    @MinLength(1)
    firstName: string;

    @IsString()
    @MinLength(1)
    lastName: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsUUID()
    role: string;
    
}
