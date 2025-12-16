"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProduct } from "@/hooks/use-product";
import { ProductForm } from "./product-form";
import { SaleList } from "./sale-list";

type Props = {
  productId?: string;
};

export function ProductFormContent({ productId }: Props) {
  const router = useRouter();
  const { data: product, isLoading, error } = useProduct(productId || "");

  const handleSuccess = () => {
    router.push("/products");
  };

  if (productId) {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Link href="/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-4">
          <Link href="/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Failed to load product: {error.message}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!product) {
      return (
        <div className="space-y-4">
          <Link href="/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Product not found</p>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/products">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
      </Link>
      {productId && product ? (
        <Tabs defaultValue="product" className="space-y-4">
          <TabsList>
            <TabsTrigger value="product">Product Details</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>
          <TabsContent value="product">
            <ProductForm product={product} onSubmit={handleSuccess} />
          </TabsContent>
          <TabsContent value="sales">
            <SaleList
              productId={productId}
              productRegularPrice={product.regularPrice || product.price}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ProductForm product={product} onSubmit={handleSuccess} />
      )}
    </div>
  );
}
