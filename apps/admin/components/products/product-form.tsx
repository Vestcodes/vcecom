"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/use-product-mutations";
import { CreateProductDto, Product, UpdateProductDto } from "@/lib/api";

const productSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must not exceed 255 characters"),
  description: z
    .string()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  gstRate: z.enum(["0", "5", "12", "18", "28"]).optional(),
  hsnCode: z
    .string()
    .max(50, "HSN code must not exceed 50 characters")
    .optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  categoryId: z.string().uuid("Category ID must be a valid UUID").optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

type Props = {
  product?: Product;
  onSubmit?: () => void;
};

export function ProductForm({ product, onSubmit }: Props) {
  const router = useRouter();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          title: product.title,
          description: product.description || "",
          price: product.price,
          gstRate: product.gstRate.toString() as "0" | "5" | "12" | "18" | "28",
          hsnCode: product.hsnCode || "",
          status: product.status,
          categoryId: product.categoryId || "",
        }
      : {
          gstRate: "0",
          status: "draft",
        },
  });

  const gstRate = watch("gstRate");
  const price = watch("price");
  const isOnSale = product?.isOnSale || false;
  const salePrice = product?.salePrice;
  const regularPrice = product?.regularPrice || product?.price || 0;

  const onFormSubmit = async (data: ProductFormData) => {
    const submitData: CreateProductDto | UpdateProductDto = {
      title: data.title,
      description: data.description || undefined,
      price: data.price,
      gstRate: data.gstRate ? parseInt(data.gstRate, 10) : undefined,
      hsnCode: data.hsnCode || undefined,
      status: data.status,
      categoryId: data.categoryId || undefined,
    };

    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, data: submitData });
      } else {
        await createProduct.mutateAsync(submitData as CreateProductDto);
      }
      onSubmit?.();
    } catch (_error) {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product ? "Edit Product" : "Create Product"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Product title"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              {...register("description")}
              placeholder="Product description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (INR) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.price && (
                <p className="text-sm text-destructive">
                  {errors.price.message}
                </p>
              )}
              {product && (
                <div className="mt-2 space-y-1">
                  {isOnSale && salePrice ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Regular Price:
                      </span>
                      <span className="line-through">
                        ₹{regularPrice.toFixed(2)}
                      </span>
                      <span className="text-destructive font-semibold">
                        Sale: ₹{salePrice.toFixed(2)}
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        ON SALE
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Regular Price: ₹{regularPrice.toFixed(2)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Manage sales in the Sales tab
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstRate">GST Rate (%)</Label>
              <Select
                value={gstRate}
                onValueChange={(value) =>
                  setValue("gstRate", value as typeof gstRate)
                }
              >
                <SelectTrigger id="gstRate">
                  <SelectValue placeholder="Select GST rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                  <SelectItem value="28">28%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {price && gstRate && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span>Price (excluding GST):</span>
                <span>
                  ₹{((price * 100) / (100 + parseInt(gstRate, 10))).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>GST Amount ({gstRate}%):</span>
                <span>
                  ₹
                  {(
                    (price * parseInt(gstRate, 10)) /
                    (100 + parseInt(gstRate, 10))
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total Price (including GST):</span>
                <span>₹{price.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hsnCode">HSN Code</Label>
              <Input
                id="hsnCode"
                {...register("hsnCode")}
                placeholder="e.g., 8518.12.00"
              />
              {errors.hsnCode && (
                <p className="text-sm text-destructive">
                  {errors.hsnCode.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) =>
                  setValue("status", value as "draft" | "active" | "archived")
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Category ID</Label>
            <Input
              id="categoryId"
              {...register("categoryId")}
              placeholder="UUID (optional)"
            />
            {errors.categoryId && (
              <p className="text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (onSubmit) {
                  onSubmit();
                } else {
                  router.push("/products");
                }
              }}
              disabled={createProduct.isPending || updateProduct.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProduct.isPending || updateProduct.isPending}
            >
              {createProduct.isPending || updateProduct.isPending
                ? "Saving..."
                : product
                  ? "Update Product"
                  : "Create Product"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
