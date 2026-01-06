"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIZARD_BUTTON_LABELS } from "@/lib/constants/wizard.constants";

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  isCreatingProduct: boolean;
  tempProductId: string | null;
  variantMode: "none" | "hasVariants";
  pendingVariantsCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onCompleteVariants: () => void;
  onGoBackToVariants: () => void;
}

/**
 * Navigation controls for wizard
 * Handles Previous/Next buttons and conditional submit buttons
 */
export function WizardNavigation({
  currentStep,
  totalSteps,
  isSubmitting,
  isCreatingProduct,
  tempProductId,
  variantMode,
  pendingVariantsCount,
  onPrevious,
  onNext,
  onCompleteVariants,
  onGoBackToVariants,
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps;
  const needsVariantCreation = Boolean(
    tempProductId &&
      variantMode === "hasVariants" &&
      pendingVariantsCount === 0,
  );
  const canCompleteVariants = Boolean(
    tempProductId && variantMode === "hasVariants" && pendingVariantsCount > 0,
  );

  return (
    <div className="flex justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={onPrevious}
        disabled={currentStep === 1}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        {WIZARD_BUTTON_LABELS.PREVIOUS}
      </Button>

      {isLastStep ? (
        <LastStepActions
          needsVariantCreation={needsVariantCreation}
          canCompleteVariants={canCompleteVariants}
          isSubmitting={isSubmitting}
          onCompleteVariants={onCompleteVariants}
          onGoBackToVariants={onGoBackToVariants}
          isCreatingProduct={isCreatingProduct}
        />
      ) : (
        <Button type="button" onClick={onNext}>
          {WIZARD_BUTTON_LABELS.NEXT}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface LastStepActionsProps {
  needsVariantCreation: boolean;
  canCompleteVariants: boolean;
  isSubmitting: boolean;
  isCreatingProduct: boolean;
  onCompleteVariants: () => void;
  onGoBackToVariants: () => void;
}

/**
 * Actions available on the last step
 */
function LastStepActions({
  needsVariantCreation,
  canCompleteVariants,
  isSubmitting,
  isCreatingProduct,
  onCompleteVariants,
  onGoBackToVariants,
}: LastStepActionsProps) {
  if (needsVariantCreation) {
    return (
      <Button type="button" onClick={onGoBackToVariants}>
        {WIZARD_BUTTON_LABELS.GO_BACK_TO_VARIANTS}
        <ChevronLeft className="ml-2 h-4 w-4" />
      </Button>
    );
  }

  if (canCompleteVariants) {
    return (
      <Button
        type="button"
        onClick={onCompleteVariants}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? WIZARD_BUTTON_LABELS.CREATING_VARIANTS
          : WIZARD_BUTTON_LABELS.COMPLETE_VARIANTS}
      </Button>
    );
  }

  return (
    <Button type="submit" disabled={isSubmitting || isCreatingProduct}>
      {isSubmitting || isCreatingProduct
        ? WIZARD_BUTTON_LABELS.CREATING
        : WIZARD_BUTTON_LABELS.CREATE_PRODUCT}
    </Button>
  );
}
