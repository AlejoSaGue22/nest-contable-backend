import { ArgumentMetadata, BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

/**
 * Convierte '' en undefined de forma recursiva para que @IsOptional()
 * omita los opcionales vacíos en la validación. Solo transforma objetos/arreglos
 * planos; deja intactos Date, Buffer y demás instancias.
 */
export function cleanEmptyBodyValues<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => cleanEmptyBodyValues(item)) as unknown as T;
    }
    if (value !== null && typeof value === 'object' && value.constructor === Object) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            result[key] = val === '' ? undefined : cleanEmptyBodyValues(val);
        }
        return result as unknown as T;
    }
    return value;
}

/** Traducción de constraints de class-validator a español (por clave, no por texto). */
const SPANISH_CONSTRAINT_MESSAGES: Record<string, string> = {
    isDefined: 'no debe estar vacío',
    isNotEmpty: 'no debe estar vacío',
    isEmpty: 'debe estar vacío',
    isNotEmptyObject: 'no debe estar vacío',
    isNotIn: 'tiene un valor no permitido',
    arrayNotEmpty: 'no debe estar vacío',
    isString: 'debe ser un texto',
    isNumber: 'debe ser un número',
    isNumberString: 'debe ser un número en texto válido',
    isInt: 'debe ser un número entero',
    isBoolean: 'debe ser verdadero o falso',
    isBooleanString: 'debe ser verdadero o falso',
    isDate: 'debe ser una fecha válida',
    isDateString: 'debe ser una fecha válida con formato AAAA-MM-DD',
    minDate: 'es anterior a la fecha mínima permitida',
    maxDate: 'supera la fecha máxima permitida',
    isArray: 'debe ser una lista',
    arrayMinSize: 'tiene muy pocos elementos',
    arrayMaxSize: 'tiene demasiados elementos',
    arrayUnique: 'no debe tener elementos duplicados',
    arrayContains: 'le faltan elementos requeridos',
    arrayNotContains: 'contiene elementos no permitidos',
    isEnum: 'tiene un valor no permitido',
    isIn: 'tiene un valor no permitido',
    isUuid: 'debe ser un identificador válido',
    isUUID: 'debe ser un identificador válido',
    isMongoId: 'debe ser un identificador válido',
    isEmail: 'debe ser un correo electrónico válido',
    isUrl: 'debe ser una URL válida',
    isFQDN: 'debe ser un dominio válido',
    isObject: 'debe ser un objeto válido',
    isInstance: 'tiene un tipo inválido',
    minLength: 'es demasiado corto',
    maxLength: 'es demasiado largo',
    length: 'tiene una longitud inválida',
    min: 'es menor al valor mínimo permitido',
    max: 'supera el valor máximo permitido',
    isPositive: 'debe ser un número positivo',
    isNegative: 'debe ser un número negativo',
    isDivisibleBy: 'tiene un valor inválido',
    matches: 'tiene un formato inválido',
    equals: 'tiene un valor no permitido',
    notEquals: 'tiene un valor no permitido',
    contains: 'tiene un formato inválido',
    notContains: 'contiene un valor no permitido',
    isAlpha: 'solo debe contener letras',
    isAlphanumeric: 'solo debe contener letras y números',
    isAscii: 'contiene caracteres inválidos',
    isCreditCard: 'debe ser una tarjeta válida',
    isISO8601: 'debe ser una fecha válida con formato AAAA-MM-DD',
    isMilitaryTime: 'debe ser una hora válida',
    whitelistValidation: 'es una propiedad no permitida',
    nestedValidation: 'contiene datos inválidos',
};

/**
 * Si el mensaje ya está en español (personalizado en el DTO), se respeta.
 * Usa límites de palabra: el nombre de la propiedad viaja dentro del mensaje
 * (ej. "numeroFacturaProveedor should...") y no debe activar la heurística.
 */
function isAlreadySpanish(message: string): boolean {
    return /\bdebe\b|válid|inválid|\bvalid[oa]s?\b|\binvalid[oa]s?\b|\bpermitid|\bvac[íi]o\b|\btexto\b|\blista\b|\bcorreo\b|\bn[úu]mero\b|\bformato\b|\bpropiedad\b/i.test(message);
}

function translateConstraints(property: string, constraints: Record<string, string>): string[] {
    return Object.entries(constraints).map(([type, original]) => {
        if (isAlreadySpanish(original)) return `${property}: ${original}`;
        const translated = SPANISH_CONSTRAINT_MESSAGES[type] ?? 'tiene un valor inválido';
        return `${property}: ${translated}`;
    });
}

function flattenErrors(errors: ValidationError[], parentPath = ''): string[] {
    const messages: string[] = [];
    for (const error of errors) {
        const path = /^\d+$/.test(error.property)
            ? `${parentPath}[${error.property}]`
            : parentPath ? `${parentPath}.${error.property}` : error.property;
        if (error.constraints) {
            messages.push(...translateConstraints(path, error.constraints));
        }
        if (error.children?.length) {
            messages.push(...flattenErrors(error.children, path));
        }
    }
    return messages;
}

export function spanishValidationExceptionFactory(errors: ValidationError[]): BadRequestException {
    const message = flattenErrors(errors);
    return new BadRequestException({
        message: message.length ? message : ['La solicitud contiene datos inválidos'],
        error: 'Petición inválida',
        statusCode: 400,
    });
}

/**
 * Pipe de validación global: limpia '' → undefined en el body antes de validar
 * y devuelve todos los errores de DTO en español, en cualquier módulo.
 */
export class GlobalValidationPipe extends ValidationPipe {
    constructor() {
        super({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: spanishValidationExceptionFactory,
        });
    }

    async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
        if (metadata.type === 'body' && value !== null && typeof value === 'object') {
            value = cleanEmptyBodyValues(value);
        }
        return super.transform(value, metadata);
    }
}
