import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role?: UserRole;
  }): Promise<User> {
    return this.userModel.create({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: input.role ?? 'buyer',
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
  }

  async findByIdForAuth(id: number): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async findById(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id, {
      attributes: [
        'id',
        'email',
        'displayName',
        'role',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }
    return user;
  }

  async updateById(
    id: number,
    patch: Partial<Pick<User, 'email' | 'displayName' | 'passwordHash'>>,
  ): Promise<User> {
    const user = await this.findByIdForAuth(id);
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable.`);
    }

    await user.update(patch);
    return this.findById(id);
  }
}
