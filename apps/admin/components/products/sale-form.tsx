"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, CreateSaleDto, Sale, UpdateSaleDto } from "@/lib/api";

const saleSchema = z
  .object({
    salePrice: z
      .number()
      .min(0, "Sale price must be greater than or equal to 0"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    name: z.string().max(255, "Name must not exceed 255 characters").optional(),
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: "Start date must be before end date",
      path: ["endDate"],
    },
  );

type SaleFormData = z.infer<typeof saleSchema>;

type Props = {
  productId: string;
  productRegularPrice: number;
  sale?: Sale;
  onSubmit?: () => void;
  onCancel?: () => void;
};

export function SaleForm({
  productId,
  productRegularPrice,
  sale,
  onSubmit,
  onCancel,
}: Props) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: sale
      ? {
          salePrice: sale.salePrice,
          startDate: sale.startDate
            ? new Date(sale.startDate).toISOString().slice(0, 16)
            : undefined,
          endDate: sale.endDate
            ? new Date(sale.endDate).toISOString().slice(0, 16)
            : undefined,
          name: sale.name || "",
          description: sale.description || "",
          priority: sale.priority,
          isActive: sale.isActive,
        }
      : {
          priority: 0,
          isActive: true,
        },
  });

  const salePrice = watch("salePrice");
  const startDate = watch("startDate");
  const endDate = watch("endDate");

  const createSale = useMutation({
    mutationFn: (data: CreateSaleDto) => adminApi.createSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("Sale created successfully");
      onSubmit?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create sale");
    },
  });

  const updateSale = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSaleDto }) =>
      adminApi.updateSale(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("Sale updated successfully");
      onSubmit?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update sale");
    },
  });

  const onFormSubmit = async (data: SaleFormData) => {
    if (data.salePrice >= productRegularPrice) {
      toast.error("Sale price must be less than regular price");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        productId,
        salePrice: data.salePrice,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        name: data.name || undefined,
        description: data.description || undefined,
        priority: data.priority || 0,
        isActive: data.isActive ?? true,
      };

      if (sale) {
        await updateSale.mutateAsync({
          id: sale.id,
          data: submitData as UpdateSaleDto,
        });
      } else {
        await createSale.mutateAsync(submitData as CreateSaleDto);
      }
    } catch (_error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sale ? "Edit Sale" : "Create Sale"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="salePrice">
              Sale Price (Regular: ₹{productRegularPrice.toFixed(2)})
            </Label>
            <Input
              id="salePrice"
              type="number"
              step="0.01"
              min="0"
              {...register("salePrice", { valueAsNumber: true })}
            />
            {errors.salePrice && (
              <p className="text-sm text-red-500">{errors.salePrice.message}</p>
            )}
            {salePrice !== undefined && salePrice >= productRegularPrice && (
              <p className="text-sm text-red-500">
                Sale price must be less than regular price
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="datetime-local"
                {...register("startDate")}
              />
              {errors.startDate && (
                <p className="text-sm text-red-500">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="datetime-local"
                {...register("endDate")}
              />
              {errors.endDate && (
                <p className="text-sm text-red-500">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          {!startDate && !endDate && (
            <p className="text-sm text-muted-foreground">
              Leave dates empty for always-active sale
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Sale Name (Optional)</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" {...register("description")} />
            {errors.description && (
              <p className="text-sm text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              {...register("priority", { valueAsNumber: true })}
            />
            <p className="text-sm text-muted-foreground">
              Higher priority sales take precedence if multiple exist
            </p>
            {errors.priority && (
              <p className="text-sm text-red-500">{errors.priority.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              {...register("isActive")}
              className="h-4 w-4"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active
            </Label>
          </div>

          <div className="flex justify-end space-x-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : sale
                  ? "Update Sale"
                  : "Create Sale"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
