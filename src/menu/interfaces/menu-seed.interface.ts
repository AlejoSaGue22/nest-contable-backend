import { Permission } from "src/common/constants/roles.constants";

export interface MenuSeedItem {
  title: string;
  icon: string;
  route?: string;
  externalUrl?: string;
  requiredPermission?: Permission;
  order: number;
  isActive: boolean;
  isVisible: boolean;
  metadata?: any;
  parent?: MenuSeedItem;
  children?: MenuSeedItem[];
}
