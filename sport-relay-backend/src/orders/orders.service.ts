import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Offer } from '../offers/entities/offer.entity';
import { Product } from '../products/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order)
    private readonly orderModel: typeof Order,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
    @InjectModel(Offer)
    private readonly offerModel: typeof Offer,
  ) {}

  async createOrder(buyerId: number, dto: CreateOrderDto): Promise<Order> {
    const quantity = dto.quantity ?? 1;
    if (quantity <= 0) {
      throw new BadRequestException('La quantite doit etre superieure a 0.');
    }

    const product = await this.productModel.findByPk(dto.productId);
    if (!product) {
      throw new BadRequestException('Produit introuvable.');
    }
    if (product.sellerId === buyerId) {
      throw new BadRequestException(
        'Un vendeur ne peut pas acheter son propre produit.',
      );
    }
    if (product.stock < quantity) {
      throw new BadRequestException('Stock insuffisant.');
    }

    const acceptedOffer = await this.offerModel.findOne({
      where: {
        productId: product.id,
        status: 'accepted',
      },
    });

    if (acceptedOffer) {
      throw new BadRequestException(
        'Une offre a deja ete acceptee pour cette annonce. L achat direct est desactive.',
      );
    }

    const totalPrice = Number(product.price) * quantity;
    product.stock = product.stock - quantity;
    await product.save();

    return this.orderModel.create({
      buyerId,
      productId: product.id,
      quantity,
      totalPrice,
      status: 'pending',
    });
  }

  async findMyOrders(buyerId: number): Promise<Order[]> {
    return this.orderModel.findAll({
      where: { buyerId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'product',
          include: [
            {
              association: 'seller',
              attributes: ['id', 'email', 'displayName', 'role', 'profileImageUrl'],
            },
          ],
        },
      ],
    });
  }

  async findSalesForSeller(sellerId: number): Promise<Order[]> {
    return this.orderModel.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'product',
          required: true,
          where: { sellerId },
        },
        {
          association: 'buyer',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
      ],
    });
  }
}
