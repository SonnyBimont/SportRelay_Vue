import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

const uploadsDir = join(__dirname, '..', '..', 'uploads');
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // 1. UPLOAD D'IMAGE
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
      },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Type de fichier invalide. Formats acceptes: JPEG, PNG, WEBP.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const extension = extname(file.originalname) || '.bin';
          cb(null, `${uniqueSuffix}${extension}`);
        },
      }),
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier recu dans le champ file.');
    }

    // Retourne l'URL complète pour le Frontend
    return { url: `http://localhost:3000/uploads/${file.filename}` };
  }

  // 2. SEEDER (Données de test)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('seed')
  async seed() {
    const seedProducts: CreateProductDto[] = [
      {
        name: 'Vélo de Route Specialized',
        description: 'Cadre carbone, excellent état, révisé.',
        price: 1450,
        category: 'Cyclisme',
        condition: 'occasion',
        imageUrl:
          'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800',
      },
      {
        name: 'Tente Husky 2 places',
        description: 'Idéal pour le bivouac léger.',
        price: 120,
        category: 'Randonnée',
        condition: 'neuf',
        imageUrl:
          'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800',
      },
      {
        name: 'Pack Haltères Ajustables',
        description: 'De 2kg à 24kg. Gain de place.',
        price: 190,
        category: 'Musculation',
        condition: 'neuf',
        imageUrl:
          'https://images.unsplash.com/photo-1581009146145-b5ef03a7403f?w=800',
      },
      {
        name: 'Raquette Wilson Pro Staff',
        description: 'La raquette de Federer, peu servie.',
        price: 150,
        category: 'Tennis',
        condition: 'occasion',
        imageUrl:
          'https://images.unsplash.com/photo-1622279457486-62dcc4a4bd13?w=800',
      },
    ];

    for (const p of seedProducts) {
      await this.productsService.create(p);
    }
    return { message: 'Base de données mise à jour avec des images réelles !' };
  }

  // 3. CRUD CLASSIQUE
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(createProductDto, user.sub);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}
