"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Form } from "@/components/ui/form";
import { useAdminCreateProduct } from "@/hooks/products/use-admin-create-product";
import { useAdminProductVariantOptionTypes } from "@/hooks/products/use-admin-product-variant-option-types";
import { useProductImageUpload } from "@/hooks/products/use-product-image-upload";
import { useProductVariantCreation } from "@/hooks/products/use-product-variant-creation";
import { useWizardValidation } from "@/hooks/products/use-wizard-validation";
import {
  WIZARD_MESSAGES,
  WIZARD_STEPS,
} from "@/lib/constants/wizard.constants";
import type {
  CreateProductFormValues,
  CreateProductInput,
} from "@/lib/validations/products";
import { createProductFormSchema } from "@/lib/validations/products";
import { PricingEditor } from "./pricing-editor";
import { type PendingVariant as CreatorPendingVariant } from "./variant-creator";
import { BasicInformationStep } from "./wizard/basic-information-step";
import { ImageUploadStep } from "./wizard/image-upload-step";
import { ReviewStep } from "./wizard/review-step";
import {
  type VariantMode,
  VariantSelectionStep,
} from "./wizard/variant-selection-step";
import { WizardNavigation } from "./wizard/wizard-navigation";
import { WizardStepIndicator } from "./wizard/wizard-step-indicator";

interface PendingVariant {
  id: string;
  price: number;
  inventory?: number;
  sku?: string;
  compareAtPrice?: number | null;
  optionValueIds?: string[];
}

interface CreateProductWizardProps {
  onComplete: (productId: string) => void;
}

/**
 * Multi-step wizard component for creating a new product
 *
 * Guides users through the product creation process with validation at each step.
 * Handles product creation, image uploads, and variant management.
 *
 * @param onComplete - Callback function called with the created product ID when wizard completes
 *
 * @example
 * ```tsx
 * <CreateProductWizard
 *   onComplete={(productId) => {
 *     router.push(`/products/${productId}`);
 *   }}
 * />
 * ```
 */
export function CreateProductWizard({ onComplete }: CreateProductWizardProps) {
  const createProductMutation = useAdminCreateProduct();
  const { uploadImages } = useProductImageUpload();
  const { createDefaultVariant, createVariants } = useProductVariantCreation();

  const [currentStep, setCurrentStep] = useState(1);
  const [variantMode, setVariantMode] = useState<VariantMode>("none");
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempProductId, setTempProductId] = useState<string | null>(null);

  const { data: optionTypes = [] } = useAdminProductVariantOptionTypes(
    tempProductId || "",
  );

  const form = useForm({
    resolver: zodResolver(createProductFormSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      gstRate: undefined,
      pricingType: "exclusive" as const,
      hsnCode: "",
      status: "draft" as const,
      categoryId: undefined,
    },
    mode: "onChange",
  });

  const { validateStep } = useWizardValidation({
    form: form as UseFormReturn<CreateProductFormValues>,
    variantMode,
    tempProductId,
    optionTypes,
    pendingVariants,
  });

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingImages((prev) => [...prev, ...Array.from(files)]);
  }, []);

  const handleRemovePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleVariantsFromCreator = useCallback(
    (variants: CreatorPendingVariant[]) => {
      const converted: PendingVariant[] = variants.map((v) => ({
        id: v.id,
        price: v.price,
        inventory: v.inventory,
        sku: v.sku,
        compareAtPrice: v.compareAtPrice,
        optionValueIds: v.optionValueIds,
      }));
      setPendingVariants(converted);
    },
    [],
  );

  const handleVariantModeChange = useCallback((mode: VariantMode) => {
    setVariantMode(mode);
    if (mode === "none") {
      setPendingVariants([]);
    }
  }, []);

  const handleNext = useCallback(async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length));
    }
  }, [currentStep, validateStep]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = useCallback(
    async (data: CreateProductFormValues) => {
      setIsSubmitting(true);
      try {
        const product = await createProductMutation.mutateAsync(
          data as CreateProductInput,
        );

        if (!product.id) {
          toast.error(WIZARD_MESSAGES.PRODUCT_CREATE_ERROR);
          return;
        }

        if (pendingImages.length > 0) {
          await uploadImages(product.id, pendingImages);
        }

        if (variantMode === "none") {
          await createDefaultVariant(product.id, data.price || 0);
          toast.success(WIZARD_MESSAGES.PRODUCT_CREATE_SUCCESS);
          onComplete(product.id);
        } else if (variantMode === "hasVariants") {
          setTempProductId(product.id);

          if (pendingVariants.length > 0) {
            await createVariants(product.id, pendingVariants);
            toast.success(WIZARD_MESSAGES.PRODUCT_CREATE_SUCCESS);
            onComplete(product.id);
          } else {
            toast.success(WIZARD_MESSAGES.PRODUCT_CREATE_VARIANTS_PENDING);
            setCurrentStep(4);
          }
        } else {
          toast.success(WIZARD_MESSAGES.PRODUCT_CREATE_SUCCESS);
          onComplete(product.id);
        }
      } catch (_error) {
        toast.error(WIZARD_MESSAGES.PRODUCT_CREATE_ERROR);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      createProductMutation,
      uploadImages,
      variantMode,
      pendingImages,
      pendingVariants,
      createDefaultVariant,
      createVariants,
      onComplete,
    ],
  );

  const handleCompleteVariants = useCallback(async () => {
    if (!tempProductId) return;

    setIsSubmitting(true);
    try {
      await createVariants(tempProductId, pendingVariants);
      toast.success(WIZARD_MESSAGES.PRODUCT_VARIANTS_COMPLETE_SUCCESS);
      onComplete(tempProductId);
    } catch (_error) {
      toast.error(WIZARD_MESSAGES.VARIANTS_COMPLETE_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }, [tempProductId, pendingVariants, createVariants, onComplete]);

  const handleGoBackToVariants = useCallback(() => {
    setCurrentStep(4);
  }, []);

  const formValues = form.watch();

  return (
    <div className="space-y-6">
      <WizardStepIndicator steps={WIZARD_STEPS} currentStep={currentStep} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <BasicInformationStep
              form={form as unknown as UseFormReturn<FieldValues>}
            />
          )}

          {currentStep === 2 && (
            <PricingStep
              formValues={
                formValues as CreateProductFormValues & {
                  pricingType: "exclusive" | "inclusive";
                }
              }
              form={form as unknown as UseFormReturn<FieldValues>}
            />
          )}

          {currentStep === 3 && (
            <ImageUploadStep
              pendingImages={pendingImages}
              onImageUpload={handleImageUpload}
              onRemoveImage={handleRemovePendingImage}
            />
          )}

          {currentStep === 4 && (
            <VariantSelectionStep
              variantMode={variantMode}
              onVariantModeChange={handleVariantModeChange}
              tempProductId={tempProductId}
              optionTypes={optionTypes}
              defaultPrice={formValues.price || 0}
              onVariantsChange={handleVariantsFromCreator}
            />
          )}

          {currentStep === 5 && (
            <ReviewStep
              formValues={
                {
                  ...formValues,
                  pricingType: (formValues.pricingType || "exclusive") as
                    | "exclusive"
                    | "inclusive",
                } as CreateProductFormValues
              }
              pendingImages={pendingImages}
              variantMode={variantMode}
              tempProductId={tempProductId}
              pendingVariants={pendingVariants}
              optionTypes={optionTypes}
            />
          )}

          <WizardNavigation
            currentStep={currentStep}
            totalSteps={WIZARD_STEPS.length}
            isSubmitting={isSubmitting}
            isCreatingProduct={createProductMutation.isPending}
            tempProductId={tempProductId}
            variantMode={variantMode}
            pendingVariantsCount={pendingVariants.length}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onCompleteVariants={handleCompleteVariants}
            onGoBackToVariants={handleGoBackToVariants}
          />
        </form>
      </Form>
    </div>
  );
}

interface PricingStepProps {
  formValues: CreateProductFormValues;
  form: ReturnType<typeof useForm>;
}

/**
 * Step 2: Pricing & Tax
 * Uses PricingEditor component for pricing configuration
 */
function PricingStep({ formValues, form }: PricingStepProps) {
  const pricingType = formValues.pricingType || "exclusive";

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{WIZARD_STEPS[1].title}</h3>
          <p className="text-sm text-muted-foreground">
            {WIZARD_STEPS[1].description}
          </p>
        </div>
        <PricingEditor
          price={formValues.price || 0}
          gstRate={formValues.gstRate ? Number(formValues.gstRate) : undefined}
          pricingType={pricingType}
          hsnCode={formValues.hsnCode}
          onPriceChange={(price) => form.setValue("price", price)}
          onGstRateChange={(rate) =>
            form.setValue(
              "gstRate",
              rate
                ? (rate.toString() as "0" | "5" | "12" | "18" | "28")
                : undefined,
            )
          }
          onPricingTypeChange={(type) => form.setValue("pricingType", type)}
          onHsnCodeChange={(code) => form.setValue("hsnCode", code)}
        />
      </div>
    </div>
  );
}
