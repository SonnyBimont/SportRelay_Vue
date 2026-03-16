import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product)
    private productModel: typeof Product,
  ) {}

  // Créer un produit
  async create(createProductDto: CreateProductDto): Promise<Product> {
    return this.productModel.create(createProductDto as any);
  }

  // Tout récupérer
  async findAll(): Promise<Product[]> {
    return this.productModel.findAll();
  }

  // Trouver un produit par son ID
  async findOne(id: number): Promise<Product> {
    const product = await this.productModel.findByPk(id);
    if (!product) {
      throw new NotFoundException(`Le produit avec l'ID ${id} n'existe pas.`);
    }
    return product;
  }

  // Mettre à jour (PATCH)
  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    return product.update(updateProductDto);
  }

  // Supprimer
  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await product.destroy();
  }
}
