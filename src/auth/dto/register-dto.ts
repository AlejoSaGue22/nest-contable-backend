import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class RegisteAuthDto {

    @Transform(({value}) => value.trim())
    @IsString()
    @MinLength(2)
    @IsNotEmpty()
    fullname: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @Transform(({value}) => value.trim())
    @IsString()
    @IsNotEmpty()
    @MinLength(4)
    password: string;

}
