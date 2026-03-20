import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { UserRole } from '../users/entities/user.entity';

export interface FindMineOptions {
  page: number;
  limit: number;
  search?: string;
}

export interface FindMineResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product)
    private productModel: typeof Product,
  ) {}

  // Créer un produit
  async create(
    createProductDto: CreateProductDto,
    sellerId?: number,
  ): Promise<Product> {
    return this.productModel.create({
      ...createProductDto,
      sellerId: sellerId ?? null,
    });
  }

  // Tout récupérer
  async findAll(): Promise<Product[]> {
    return this.productModel.findAll({
      include: [
        {
          association: 'seller',
          attributes: ['id', 'email', 'displayName', 'role', 'profileImageUrl'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async findMine(
    sellerId: number,
    options: FindMineOptions,
  ): Promise<FindMineResult> {
    const page = Number.isFinite(options.page) ? options.page : 1;
    const limit = Number.isFinite(options.limit) ? options.limit : 10;
    const safePage = page > 0 ? page : 1;
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const offset = (safePage - 1) * safeLimit;

    const trimmedSearch = options.search?.trim() ?? '';

    const whereClause = {
      sellerId,
      ...(trimmedSearch
        ? {
            [Op.or]: [
              {
                name: {
                  [Op.like]: `%${trimmedSearch}%`,
                },
              },
              {
                description: {
                  [Op.like]: `%${trimmedSearch}%`,
                },
              },
              {
                category: {
                  [Op.like]: `%${trimmedSearch}%`,
                },
              },
              {
                condition: {
                  [Op.like]: `%${trimmedSearch}%`,
                },
              },
            ],
          }
        : {}),
    };

    const result = await this.productModel.findAndCountAll({
      where: whereClause,
      include: [
        {
          association: 'seller',
          attributes: ['id', 'email', 'displayName', 'role', 'profileImageUrl'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset,
    });

    const totalPages = Math.max(1, Math.ceil(result.count / safeLimit));

    return {
      items: result.rows,
      total: result.count,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  // Trouver un produit par son ID
  async findOne(id: number): Promise<Product> {
    const product = await this.productModel.findByPk(id, {
      include: [
        {
          association: 'seller',
          attributes: ['id', 'email', 'displayName', 'role', 'profileImageUrl'],
        },
      ],
    });
    if (!product) {
      throw new NotFoundException(`Le produit avec l'ID ${id} n'existe pas.`);
    }
    return product;
  }

  // Mettre à jour (PATCH)
  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    user?: { id: number; role: UserRole },
  ): Promise<Product> {
    const product = await this.findOne(id);

    if (
      user &&
      user.role !== 'admin' &&
      product.sellerId !== null &&
      product.sellerId !== user.id
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres annonces.',
      );
    }

    return product.update(updateProductDto);
  }

  // Supprimer
  async remove(
    id: number,
    user?: { id: number; role: UserRole },
  ): Promise<void> {
    const product = await this.findOne(id);

    if (
      user &&
      user.role !== 'admin' &&
      product.sellerId !== null &&
      product.sellerId !== user.id
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres annonces.',
      );
    }

    await product.destroy();
  }

  async reduceStock(productId: number, quantity: number) {
    const product = await this.productModel.findByPk(productId);

    if (!product) {
      throw new Error(`Produit ${productId} introuvable`);
    }

    const newStock = product.stock - quantity;

    if (newStock < 0) {
      throw new Error(`Stock insuffisant pour le produit ${productId}`);
    }

    // Mise à jour en base de données
    await product.update({ stock: newStock });

    console.log(`Stock mis à jour pour ${product.name}: ${newStock} restants.`);
    return product;
  }
}
