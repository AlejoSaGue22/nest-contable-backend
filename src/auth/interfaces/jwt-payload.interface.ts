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
    user: User
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}