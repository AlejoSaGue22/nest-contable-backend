import { Permission } from "src/common/constants/roles.constants";

export interface MenuSeedItem {
  title: string;
  icon: string;
  route?: string;
  externalUrl?: string;
  requiredPermission?: string;
  order: number;
  other?: string;
  isActive: boolean;
  isVisible: boolean;
  metadata?: any;
  parent?: MenuSeedItem | null;
  children?: MenuSeedItem[];
}
