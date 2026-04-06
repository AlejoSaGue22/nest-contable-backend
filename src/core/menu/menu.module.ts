import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu.entity';
import { Permission } from '../roles/entities/permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem, Permission])],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService]
})
export class MenuModule {}
