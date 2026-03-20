import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Product } from '../products/entities/product.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { UserRole } from '../users/entities/user.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { Offer } from './entities/offer.entity';

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer)
    private readonly offerModel: typeof Offer,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createOffer(buyerId: number, dto: CreateOfferDto): Promise<Offer> {
    if (!Number.isFinite(dto.amount) || Number(dto.amount) <= 0) {
      throw new BadRequestException(
        'Le montant de l offre doit etre superieur a 0.',
      );
    }

    const quantity = Number(dto.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'La quantite de l offre doit etre un entier superieur a 0.',
      );
    }

    const product = await this.productModel.findByPk(dto.productId);
    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    if (!product.sellerId) {
      throw new BadRequestException(
        'Cette annonce ne peut pas recevoir d offres.',
      );
    }

    if (Number(product.stock) <= 0) {
      throw new BadRequestException('Cette annonce n est plus disponible.');
    }

    if (quantity > Number(product.stock)) {
      throw new BadRequestException('Stock insuffisant pour cette offre.');
    }

    if (product.sellerId === buyerId) {
      throw new BadRequestException(
        'Tu ne peux pas faire une offre sur ta propre annonce.',
      );
    }

    const offer = await this.offerModel.create({
      productId: product.id,
      buyerId,
      amount: Number(dto.amount),
      quantity,
      message: dto.message?.trim() || null,
      status: 'pending',
      sellerResponse: null,
    });

    const productId = Number(product.id);
    const sellerId = Number(product.sellerId);

    this.realtimeService.emitOfferUpdated(productId, offer);
    if (Number.isFinite(sellerId) && sellerId > 0) {
      this.realtimeService.emitConversationListUpdated([sellerId, buyerId]);
    }

    return offer;
  }

  async findMyOffers(userId: number): Promise<Offer[]> {
    return this.offerModel.findAll({
      where: { buyerId: userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'product',
          include: [
            {
              association: 'seller',
              attributes: ['id', 'email', 'displayName', 'role'],
            },
          ],
        },
      ],
    });
  }

  async findProductOffers(
    productId: number,
    user: { id: number; role: UserRole },
  ): Promise<Offer[]> {
    const product = await this.productModel.findByPk(productId);
    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    if (user.role === 'admin' || product.sellerId === user.id) {
      return this.offerModel.findAll({
        where: { productId },
        order: [['createdAt', 'DESC']],
        include: [
          {
            association: 'buyer',
            attributes: ['id', 'email', 'displayName', 'role'],
          },
        ],
      });
    }

    return this.offerModel.findAll({
      where: {
        productId,
        buyerId: user.id,
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'buyer',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
      ],
    });
  }

  async findReceivedOffers(sellerId: number): Promise<Offer[]> {
    return this.offerModel.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'product',
          required: true,
          where: { sellerId },
          attributes: ['id', 'name', 'price', 'imageUrl'],
        },
        {
          association: 'buyer',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
      ],
    });
  }

  async updateOfferStatus(
    offerId: number,
    user: { id: number; role: UserRole },
    dto: UpdateOfferStatusDto,
  ): Promise<Offer> {
    const offer = await this.offerModel.findByPk(offerId, {
      include: [
        {
          association: 'product',
          attributes: ['id', 'sellerId', 'name', 'stock'],
        },
      ],
    });

    if (!offer) {
      throw new NotFoundException('Offre introuvable.');
    }

    const product = offer.product;
    if (!product) {
      throw new NotFoundException('Produit associe introuvable.');
    }

    const canManage = user.role === 'admin' || product.sellerId === user.id;
    if (!canManage) {
      throw new ForbiddenException(
        'Seul le vendeur de l annonce peut gerer cette offre.',
      );
    }

    const nextStatus = dto.status;
    if (!['pending', 'accepted', 'rejected'].includes(nextStatus)) {
      throw new BadRequestException('Statut d offre invalide.');
    }

    if (offer.status === 'accepted' && nextStatus !== 'accepted') {
      throw new BadRequestException(
        'Une offre deja acceptee ne peut plus etre modifiee.',
      );
    }

    if (offer.status === 'paid') {
      throw new BadRequestException(
        'Une offre deja payee ne peut plus etre modifiee.',
      );
    }

    if (nextStatus === 'accepted') {
      const offerQuantity = Number(offer.quantity ?? 1);
      if (offerQuantity <= 0) {
        throw new BadRequestException('Quantite d offre invalide.');
      }

      if (Number(product.stock) < offerQuantity) {
        throw new BadRequestException('Le produit n est plus en stock.');
      }
    }

    const previousStatus = offer.status;

    await offer.update({
      status: nextStatus,
      sellerResponse: dto.sellerResponse?.trim() || null,
    });

    if (nextStatus === 'accepted' && previousStatus !== 'accepted') {
      const acceptedQuantity = Number(offer.quantity ?? 1);
      if (Number(product.stock) < acceptedQuantity) {
        throw new BadRequestException('Le produit n est plus en stock.');
      }
    }

    const productId = Number(product.id);
    const sellerId = Number(product.sellerId);
    const buyerId = Number(offer.buyerId);

    this.realtimeService.emitOfferUpdated(productId, offer);
    if (Number.isFinite(sellerId) && sellerId > 0) {
      this.realtimeService.emitConversationListUpdated([buyerId, sellerId]);
    }

    return offer;
  }
}
