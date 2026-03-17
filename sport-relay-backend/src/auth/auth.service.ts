import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Product } from '../products/entities/product.entity';
import type { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { JwtUser } from './interfaces/jwt-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
  ) {}

  private async ensureUser(input: {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
  }) {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      return existing;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.usersService.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: input.role,
    });
  }

  private normalizeRole(role: unknown): UserRole {
    if (role === 'seller' || role === 'admin') {
      return role;
    }
    return 'buyer';
  }

  private toPublicUser(user: {
    id?: unknown;
    email?: unknown;
    displayName?: unknown;
    role?: unknown;
  }) {
    return {
      id: Number(user.id),
      email: String(user.email),
      displayName: String(user.displayName),
      role: this.normalizeRole(user.role),
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Cet email est deja utilise.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: dto.role ?? 'buyer',
    });
    const publicUser = this.toPublicUser(user);

    const tokenPayload: JwtUser = {
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(tokenPayload),
      user: publicUser,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    const publicUser = this.toPublicUser(user);

    const tokenPayload: JwtUser = {
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(tokenPayload),
      user: publicUser,
    };
  }

  async fakeSeed() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Le fake seeding est desactive en production.',
      );
    }

    const admin = await this.ensureUser({
      email: 'admin@sportrelay.local',
      password: 'Admin123!',
      displayName: 'Admin SportRelay',
      role: 'admin',
    });
    const seller = await this.ensureUser({
      email: 'seller@sportrelay.local',
      password: 'Seller123!',
      displayName: 'Camille Vendeur',
      role: 'seller',
    });
    const buyer = await this.ensureUser({
      email: 'buyer@sportrelay.local',
      password: 'Buyer123!',
      displayName: 'Alex Acheteur',
      role: 'buyer',
    });

    const demoProducts: Array<{
      name: string;
      description: string;
      price: number;
      category: string;
      condition: string;
      stock: number;
      imageUrl: string;
    }> = [
      {
        name: 'VTT RockRider 540',
        description: 'VTT trail 27.5, revision recente, ideal foret.',
        price: 520,
        category: 'Cyclisme',
        condition: 'occasion',
        stock: 1,
        imageUrl:
          'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800',
      },
      {
        name: 'Chaussures de rando Salomon',
        description: 'Pointure 42, semelle en bon etat, tres confortables.',
        price: 85,
        category: 'Randonnée',
        condition: 'occasion',
        stock: 2,
        imageUrl:
          'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800',
      },
      {
        name: 'Banc de musculation pliable',
        description: 'Banc inclinable, tres peu utilise, gain de place.',
        price: 130,
        category: 'Musculation',
        condition: 'neuf',
        stock: 1,
        imageUrl:
          'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800',
      },
    ];

    for (const item of demoProducts) {
      const existingProduct = await this.productModel.findOne({
        where: {
          sellerId: seller.id,
          name: item.name,
        },
      });

      if (!existingProduct) {
        await this.productModel.create({
          ...item,
          sellerId: seller.id,
        });
      }
    }

    return {
      message: 'Fake seeding termine (users + products).',
      credentials: [
        {
          role: 'admin',
          email: admin.email,
          password: 'Admin123!',
        },
        {
          role: 'seller',
          email: seller.email,
          password: 'Seller123!',
        },
        {
          role: 'buyer',
          email: buyer.email,
          password: 'Buyer123!',
        },
      ],
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.usersService.findByIdForAuth(userId);
    if (!user) {
      throw new UnauthorizedException('Session invalide.');
    }

    const patch: { email?: string; displayName?: string } = {};

    if (dto.displayName !== undefined) {
      const displayName = dto.displayName.trim();
      if (displayName.length < 2 || displayName.length > 80) {
        throw new BadRequestException(
          'Le nom affiche doit contenir entre 2 et 80 caracteres.',
        );
      }
      patch.displayName = displayName;
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException('Format email invalide.');
      }

      if (email !== user.email) {
        const existing = await this.usersService.findByEmail(email);
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Cet email est deja utilise.');
        }
      }
      patch.email = email;
    }

    if (Object.keys(patch).length === 0) {
      return this.usersService.findById(userId);
    }

    return this.usersService.updateById(userId, patch);
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdForAuth(userId);
    if (!user) {
      throw new UnauthorizedException('Session invalide.');
    }

    const currentPassword = dto.currentPassword ?? '';
    const newPassword = dto.newPassword ?? '';

    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit contenir entre 8 et 128 caracteres.',
      );
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit etre different de l ancien.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updateById(userId, { passwordHash });

    return { message: 'Mot de passe mis a jour avec succes.' };
  }
}
