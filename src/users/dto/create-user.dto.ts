import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

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
    fullName: string;

    @IsUUID()
    roleId: string;
    
}
