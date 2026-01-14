import { Permission, UserRole } from "src/common/constants/roles.constants"
import { User } from "src/users/entities/user.entity"

export interface JwtPayload {
    sub: string;
    email: string;
    name: string;
    role: UserRole;
    permissions: Permission[];
    exp?: number;
}

export interface RequestWithUser extends Request {
    user: JwtPayload
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}