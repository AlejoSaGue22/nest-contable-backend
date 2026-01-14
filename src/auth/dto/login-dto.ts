import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginAuthDto {

    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) => value.toLowerCase().trim())
    email: string

    @IsNotEmpty()
    @IsString()
    @MinLength(4)
    @Transform(({ value }) => value.trim())
    password: string

}
