"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi, Sale } from "@/lib/api";
import { SaleForm } from "./sale-form";

type Props = {
  productId: string;
  productRegularPrice: number;
};

export function SaleList({ productId, productRegularPrice }: Props) {
  const queryClient = useQueryClient();
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", productId],
    queryFn: () => adminApi.getSales(productId),
  });

  const deleteSale = useMutation({
    mutationFn: (id: string) => adminApi.deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("Sale deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete sale");
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateSaleStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast.success("Sale status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update sale status");
    },
  });

  const getStatusBadgeVariant = (status: Sale["status"]) => {
    switch (status) {
      case "active":
        return "default";
      case "scheduled":
        return "secondary";
      case "expired":
        return "destructive";
      case "disabled":
        return "outline";
      default:
        return "outline";
    }
  };

  if (showCreateForm || editingSale) {
    return (
      <SaleForm
        productId={productId}
        productRegularPrice={productRegularPrice}
        sale={editingSale || undefined}
        onSubmit={() => {
          setShowCreateForm(false);
          setEditingSale(null);
        }}
        onCancel={() => {
          setShowCreateForm(false);
          setEditingSale(null);
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Product Sales</CardTitle>
            <CardDescription>
              Manage sale prices for this product
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>Create Sale</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading sales...</p>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No sales found</p>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="mt-4"
              variant="outline"
            >
              Create First Sale
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        ₹{sale.salePrice.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Regular: ₹{productRegularPrice.toFixed(2)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(sale.status)}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sale.startDate || sale.endDate ? (
                      <div className="text-sm">
                        <div>
                          {sale.startDate
                            ? format(new Date(sale.startDate), "MMM dd, yyyy")
                            : "Always"}
                        </div>
                        <div className="text-muted-foreground">
                          {sale.endDate
                            ? format(new Date(sale.endDate), "MMM dd, yyyy")
                            : "No end"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Always active
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{sale.priority}</TableCell>
                  <TableCell>
                    <Badge variant={sale.isActive ? "default" : "outline"}>
                      {sale.isActive ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingSale(sale)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStatus.mutate({
                            id: sale.id,
                            isActive: !sale.isActive,
                          })
                        }
                      >
                        {sale.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this sale?",
                            )
                          ) {
                            deleteSale.mutate(sale.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
