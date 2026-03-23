import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('seller publishes product with image', async () => {
    await request(app.getHttpServer()).post('/auth/fake-seed').expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'seller@sportrelay.local',
        password: 'Seller123!',
      })
      .expect(201);

    const token = loginResponse.body.accessToken as string;
    expect(token).toBeDefined();

    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8BfXgAAAAASUVORK5CYII=';

    const uploadResponse = await request(app.getHttpServer())
      .post('/products/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(png1x1, 'base64'), {
        filename: 'e2e-image.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(uploadResponse.body.url).toContain('/uploads/');

    const productName = `E2E publish ${Date.now()}`;
    const createResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: productName,
        description: 'Produit cree en e2e apres upload image.',
        price: 49,
        stock: 1,
        category: 'Cyclisme',
        condition: 'occasion',
        imageUrl: uploadResponse.body.url,
      })
      .expect(201);

    expect(createResponse.body.name).toBe(productName);
    expect(createResponse.body.imageUrl).toBe(uploadResponse.body.url);

    await request(app.getHttpServer())
      .delete(`/products/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
