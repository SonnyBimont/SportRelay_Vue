import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Favorite } from './entities/favorite.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite)
    private readonly favoriteModel: typeof Favorite,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
  ) {}

  async listFavoriteProductIds(userId: number): Promise<number[]> {
    const rows = await this.favoriteModel.findAll({
      where: { userId },
      attributes: ['productId'],
      order: [['createdAt', 'DESC']],
    });

    return rows
      .map((row) => Number(row.productId))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  async listFavoriteProducts(userId: number): Promise<Product[]> {
    const rows = await this.favoriteModel.findAll({
      where: { userId },
      attributes: ['productId'],
      order: [['createdAt', 'DESC']],
    });

    const productIds = rows
      .map((row) => Number(row.productId))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (productIds.length === 0) {
      return [];
    }

    const products = await this.productModel.findAll({
      where: {
        id: {
          [Op.in]: productIds,
        },
      },
      include: [
        {
          association: 'seller',
          attributes: ['id', 'email', 'displayName', 'role', 'profileImageUrl'],
        },
      ],
    });

    const byId = new Map(
      products.map((product) => [Number(product.id), product]),
    );
    return productIds
      .map((id) => byId.get(id))
      .filter((product): product is Product => Boolean(product));
  }

  async addFavorite(userId: number, productId: number): Promise<void> {
    const product = await this.productModel.findByPk(productId, {
      attributes: ['id'],
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    await this.favoriteModel.findOrCreate({
      where: { userId, productId },
      defaults: { userId, productId },
    });
  }

  async removeFavorite(userId: number, productId: number): Promise<void> {
    await this.favoriteModel.destroy({
      where: { userId, productId },
    });
  }
}
