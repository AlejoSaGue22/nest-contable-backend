import { Permission, SystemRole } from "src/common/constants/roles.constants"
import { User } from "src/users/entities/user.entity"

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: SystemRole;
  permissions: string[];
  /** Aditivo multi-empresa: opcional para no invalidar tokens/juicios actuales. */
  empresaId?: string | null;
  empresasPermitidas?: string[];
  exp?: number;
}

export interface RequestWithUser extends Request {
  user: JwtPayload
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}