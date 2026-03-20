import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Product } from '../products/entities/product.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Order } from '../orders/entities/order.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RealtimeService } from '../realtime/realtime.service';

interface CreateCheckoutSessionDto {
  productId: number;
  quantity?: number;
  offerId?: number;
  isOffer?: boolean;
}

interface ConfirmCheckoutSessionDto {
  sessionId: string;
}

@Controller('payments')
export class PaymentsController {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private readonly realtimeService: RealtimeService,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
    @InjectModel(Offer)
    private readonly offerModel: typeof Offer,
    @InjectModel(Order)
    private readonly orderModel: typeof Order,
  ) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!key) {
      throw new Error('La clé STRIPE_SECRET_KEY est introuvable');
    }
    this.stripe = new Stripe(key);
  }

  private async finalizeCompletedSession(
    session: Stripe.Checkout.Session,
    expectedBuyerId?: number,
  ): Promise<{ status: 'processed' | 'already_processed' | 'ignored' }> {
    const metadata = session.metadata ?? {};
    const checkoutType = metadata.checkoutType;
    const stripeSessionId = session.id;

    if (!stripeSessionId) {
      return { status: 'ignored' };
    }

    const existingOrder = await this.orderModel.findOne({
      where: { stripeSessionId },
    });

    if (existingOrder) {
      return { status: 'already_processed' };
    }

    const buyerId = Number(metadata.buyerId);
    if (!Number.isFinite(buyerId) || buyerId <= 0) {
      return { status: 'ignored' };
    }

    if (expectedBuyerId !== undefined && expectedBuyerId !== buyerId) {
      throw new BadRequestException(
        'Session de paiement invalide pour cet utilisateur.',
      );
    }

    if (checkoutType === 'offer') {
      const offerId = Number(metadata.offerId);
      if (!Number.isFinite(offerId) || offerId <= 0) {
        return { status: 'ignored' };
      }

      const offer = await this.offerModel.findByPk(offerId, {
        include: [
          {
            association: 'product',
            attributes: ['id', 'sellerId', 'stock'],
          },
        ],
      });

      if (!offer || !offer.product) {
        return { status: 'ignored' };
      }

      if (offer.status !== 'accepted') {
        return { status: 'ignored' };
      }

      const quantity = Number(offer.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return { status: 'ignored' };
      }

      if (Number(offer.product.stock) < quantity) {
        return { status: 'ignored' };
      }

      offer.product.stock = Number(offer.product.stock) - quantity;
      await offer.product.save();

      await this.orderModel.create({
        buyerId,
        productId: Number(offer.productId),
        quantity,
        totalPrice: Number(offer.amount) * quantity,
        status: 'paid',
        stripeSessionId,
      });

      await offer.update({ status: 'paid' });

      const sellerId = Number(offer.product.sellerId ?? 0);
      const productId = Number(offer.product.id);
      this.realtimeService.emitOfferUpdated(productId, offer);
      if (sellerId > 0) {
        this.realtimeService.emitConversationListUpdated([buyerId, sellerId]);
      }

      return { status: 'processed' };
    }

    if (checkoutType === 'direct') {
      const productId = Number(metadata.productId);
      const quantity = Number(metadata.quantity);

      if (!Number.isFinite(productId) || !Number.isFinite(quantity)) {
        return { status: 'ignored' };
      }

      const product = await this.productModel.findByPk(productId);
      if (!product) {
        return { status: 'ignored' };
      }

      if (Number(product.stock) < quantity) {
        return { status: 'ignored' };
      }

      product.stock = Number(product.stock) - quantity;
      await product.save();

      await this.orderModel.create({
        buyerId,
        productId,
        quantity,
        totalPrice: Number(product.price) * quantity,
        status: 'paid',
        stripeSessionId,
      });

      const sellerId = Number(product.sellerId ?? 0);
      if (sellerId > 0) {
        this.realtimeService.emitConversationListUpdated([buyerId, sellerId]);
      }

      return { status: 'processed' };
    }

    return { status: 'ignored' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout-session')
  async createCheckoutSession(
    @CurrentUser() user: JwtUser,
    @Body()
    data: CreateCheckoutSessionDto,
  ) {
    const isOfferPayment = Boolean(data.isOffer);
    const buyerId = Number(user.sub);

    if (!Number.isFinite(buyerId) || buyerId <= 0) {
      throw new BadRequestException('Utilisateur invalide.');
    }

    if (isOfferPayment) {
      const offerId = Number(data.offerId);
      if (!Number.isFinite(offerId) || offerId <= 0) {
        throw new BadRequestException('Offre invalide.');
      }

      const offer = await this.offerModel.findByPk(offerId, {
        include: [
          {
            association: 'product',
            attributes: ['id', 'name', 'stock', 'sellerId'],
          },
        ],
      });

      if (!offer || !offer.product) {
        throw new BadRequestException('Offre introuvable.');
      }

      if (Number(offer.buyerId) !== buyerId) {
        throw new BadRequestException('Cette offre ne vous appartient pas.');
      }

      if (offer.status !== 'accepted') {
        throw new BadRequestException('Cette offre n est pas payable.');
      }

      const quantity = Number(offer.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('Quantite d offre invalide.');
      }

      if (Number(offer.product.stock) < quantity) {
        throw new BadRequestException('Stock insuffisant pour cette offre.');
      }

      const unitAmountCents = Math.round(Number(offer.amount) * 100);
      if (!Number.isInteger(unitAmountCents) || unitAmountCents <= 0) {
        throw new BadRequestException('Montant d offre invalide.');
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: { name: offer.product.name },
              unit_amount: unitAmountCents,
            },
            quantity,
          },
        ],
        mode: 'payment',
        metadata: {
          checkoutType: 'offer',
          offerId: String(offer.id),
          productId: String(offer.productId),
          quantity: String(quantity),
          buyerId: String(buyerId),
        },
        success_url: `http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}&type=offer&offerId=${offer.id}`,
        cancel_url: `http://localhost:5173/product/${offer.productId}`,
      });

      return { url: session.url };
    }

    const productId = Number(data.productId);
    const quantity = Number(data.quantity ?? 1);

    if (!Number.isFinite(productId) || productId <= 0) {
      throw new BadRequestException('Produit invalide.');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantite invalide.');
    }

    const product = await this.productModel.findByPk(productId);
    if (!product) {
      throw new BadRequestException('Produit introuvable.');
    }

    if (product.sellerId && Number(product.sellerId) === buyerId) {
      throw new BadRequestException(
        'Vous ne pouvez pas acheter votre propre annonce.',
      );
    }

    if (Number(product.stock) < quantity) {
      throw new BadRequestException('Stock insuffisant.');
    }

    const unitAmountCents = Math.round(Number(product.price) * 100);
    if (!Number.isInteger(unitAmountCents) || unitAmountCents <= 0) {
      throw new BadRequestException('Montant produit invalide.');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: product.name },
            unit_amount: unitAmountCents,
          },
          quantity,
        },
      ],
      mode: 'payment',
      metadata: {
        checkoutType: 'direct',
        productId: String(product.id),
        quantity: String(quantity),
        buyerId: String(buyerId),
      },
      success_url: `http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}&type=direct&productId=${product.id}`,
      cancel_url: `http://localhost:5173/product/${product.id}`,
    });

    return { url: session.url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm-session')
  async confirmCheckoutSession(
    @CurrentUser() user: JwtUser,
    @Body() data: ConfirmCheckoutSessionDto,
  ) {
    const sessionId = String(data.sessionId ?? '').trim();
    if (!sessionId.startsWith('cs_')) {
      throw new BadRequestException('Session Stripe invalide.');
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return { status: 'ignored' };
    }

    return this.finalizeCompletedSession(session, Number(user.sub));
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    const endpointSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )!;
    let event: Stripe.Event;
    const rawBody = req.rawBody;

    if (!rawBody) {
      return { error: 'Webhook Error' };
    }

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`Webhook signature error: ${message}`);
      return { error: 'Webhook Error' };
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await this.finalizeCompletedSession(session);
    }

    return { received: true };
  }
}
