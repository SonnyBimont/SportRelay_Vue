import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // On utilise NestExpressApplication pour accéder aux options d'Express
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // CRUCIAL pour les webhooks Stripe
  });

  app.enableCors();

  // Sert le dossier 'uploads' de manière statique
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  await app.listen(3000);
}
void bootstrap();
