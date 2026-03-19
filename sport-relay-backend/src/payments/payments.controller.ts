import { Controller, Post, Body, Req, Headers, RawBodyRequest } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from '../products/products.service';

@Controller('payments')
export class PaymentsController {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private productsService: ProductsService) 
    {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!key) {
      throw new Error('La clé STRIPE_SECRET_KEY est introuvable');
    }
    this.stripe = new Stripe(key);
  }

  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body()
    data: {
      productName: string;
      amount: number;
      productId: number;
      quantity: number;
    },
  ) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: data.productName },
            unit_amount: Math.round(data.amount * 100),
          },
          quantity: data.quantity,
        },
      ],
      mode: 'payment',
      // --- AJOUT DES METADATA ---
      metadata: {
        productId: data.productId.toString(),
        quantity: data.quantity.toString(),
      },
      // ----------------------------------
      success_url: `http://localhost:5173/success`,
      cancel_url: `http://localhost:5173/product/${data.productId}`,
    });

    return { url: session.url };
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: any, // On utilise req pour accéder au rawBody
    @Headers('stripe-signature') sig: string,
  ) {
    const endpointSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )!;
    let event;

    try {
      // Construction de l'événement avec le corps brut (rawBody)
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        endpointSecret,
      );
    } catch (err) {
      console.error(`❌ Erreur Webhook Signature: ${err.message}`);
      return { error: 'Webhook Error' };
    }

    // Événement cible : le paiement est validé
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // Récupération des metadata envoyées lors de la création de la session
      const productId = Number(session.metadata.productId);
      const quantity = Number(session.metadata.quantity);

      if (productId && quantity) {
        try {
          await this.productsService.reduceStock(productId, quantity);
          console.log('✅ Stock réduit avec succès via Webhook');
        } catch (error) {
          console.error(
            '❌ Erreur lors de la réduction du stock:',
            error.message,
          );
        }
      }
    }

    return { received: true };
  }
}
