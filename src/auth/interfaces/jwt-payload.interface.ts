import { UserRole } from "src/common/constants/roles.constants"
import { User } from "src/users/entities/user.entity"

export interface JwtPayload {
    email: string
    id?: string
    role?: string
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