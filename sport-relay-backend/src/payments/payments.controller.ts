import { Controller, Post, Body } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class PaymentsController {
  private stripe: Stripe;

constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (!key) {
      throw new Error("La clé STRIPE_SECRET_KEY est introuvable");
    }

    this.stripe = new Stripe(key);
  }

  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body() data: { productName: string; amount: number; productId: number },
  ) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: data.productName,
            },
            unit_amount: data.amount * 100, // Stripe travaille en centimes (10€ = 1000)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:5173/success`,
      cancel_url: `http://localhost:5173/product/${data.productId}`,
    });

    return { url: session.url }; // On renvoie l'URL de la page de paiement Stripe
  }
}
