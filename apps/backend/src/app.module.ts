import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AddressAutocompleteModule } from "./modules/address-autocomplete/address-autocomplete.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { DiscountsModule } from "./modules/discounts/discounts.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ProductsModule } from "./modules/products/products.module";
import { SalesModule } from "./modules/sales/sales.module";
import { ShippingModule } from "./modules/shipping/shipping.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    AdminModule,
    InvoicesModule,
    AddressAutocompleteModule,
    DiscountsModule,
    SalesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
