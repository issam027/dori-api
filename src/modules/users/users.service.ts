import { Injectable } from '@nestjs/common';
import {
  CreateUserDto,
  SetUserPasswordDto,
  UpdateRolePermissionsDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserFilterDto,
} from './dto/user.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findUsers(filter: UserFilterDto, user: AuthenticatedUser) {
    return this.usersRepository.findUsers(filter, user);
  }

  findUserById(userId: number, user: AuthenticatedUser) {
    return this.usersRepository.findUserById(userId, user);
  }

  createUser(dto: CreateUserDto, user: AuthenticatedUser) {
    return this.usersRepository.createUser(dto, user);
  }

  updateUser(userId: number, dto: UpdateUserDto, user: AuthenticatedUser) {
    return this.usersRepository.updateUser(userId, dto, user);
  }

  updateUserStatus(
    userId: number,
    dto: UpdateUserStatusDto,
    user: AuthenticatedUser,
  ) {
    return this.usersRepository.updateUserStatus(userId, dto, user);
  }

  setUserPassword(
    userId: number,
    dto: SetUserPasswordDto,
    user: AuthenticatedUser,
  ) {
    return this.usersRepository.setUserPassword(userId, dto, user);
  }

  assignUserRole(userId: number, roleId: number, user: AuthenticatedUser) {
    return this.usersRepository.assignUserRole(userId, roleId, user);
  }

  removeUserRole(userId: number, roleId: number, user: AuthenticatedUser) {
    return this.usersRepository.removeUserRole(userId, roleId, user);
  }

  getRoles(pagination: PaginationDto) {
    return this.usersRepository.getRoles(pagination);
  }

  updateRolePermissions(
    roleId: number,
    dto: UpdateRolePermissionsDto,
    user: AuthenticatedUser,
  ) {
    return this.usersRepository.updateRolePermissions(roleId, dto, user);
  }

  deleteUser(userId: number, user: AuthenticatedUser) {
    return this.usersRepository.deleteUser(userId, user);
  }
}
