/**
 * Centralized API endpoint constants
 * Type-safe endpoint references
 */

export const endpoints = {
  auth: {
    login: "/admin/auth/login",
    me: "/admin/auth/me",
    refresh: "/admin/auth/refresh",
    logout: "/admin/auth/logout",
    sessions: "/admin/auth/sessions",
  },
  products: {
    list: "/admin/products",
    detail: (id: string) => `/admin/products/${id}`,
    create: "/admin/products",
    update: (id: string) => `/admin/products/${id}`,
    delete: (id: string) => `/admin/products/${id}`,
    collections: (id: string) => `/admin/products/${id}/collections`,
    images: {
      list: (id: string) => `/admin/products/${id}/images`,
      add: (id: string) => `/admin/products/${id}/images`,
      delete: (imageId: string) => `/admin/products/images/${imageId}`,
      updateOrder: (imageId: string) =>
        `/admin/products/images/${imageId}/order`,
      update: (imageId: string) => `/admin/products/images/${imageId}`,
      replace: (imageId: string) => `/admin/products/images/${imageId}/replace`,
    },
    variantImages: {
      list: (productId: string, variantId: string) =>
        `/admin/products/${productId}/variants/${variantId}/images`,
    },
    variants: {
      list: (productId: string) => `/admin/products/${productId}/variants`,
      detail: (productId: string, variantId: string) =>
        `/admin/products/${productId}/variants/${variantId}`,
      create: (productId: string) => `/admin/products/${productId}/variants`,
      update: (productId: string, variantId: string) =>
        `/admin/products/${productId}/variants/${variantId}`,
      delete: (productId: string, variantId: string) =>
        `/admin/products/${productId}/variants/${variantId}`,
    },
  },
  storage: {
    upload: "/admin/storage/upload",
    uploadBatch: "/admin/storage/upload/batch",
    uploadEnhanced: "/admin/storage/upload/enhanced",
    list: "/admin/storage/list",
    get: (key: string) => `/admin/storage/${key}`,
    delete: (key: string) => `/admin/storage/${key}`,
    batchDelete: "/admin/storage/batch",
    presignedUrl: "/admin/storage/presigned-url",
    signedDownloadUrl: "/admin/storage/signed-download-url",
  },
  inventory: {
    list: "/admin/inventory",
    detail: (variantId: string) => `/admin/inventory/${variantId}`,
    adjust: (variantId: string) => `/admin/inventory/${variantId}/adjust`,
    bulkAdjust: "/admin/inventory/bulk-adjust",
    logs: (variantId: string) => `/admin/inventory/${variantId}/logs`,
    reservations: (variantId: string) =>
      `/admin/inventory/${variantId}/reservations`,
    reservationsSummary: "/admin/inventory/reservations/summary",
    health: "/admin/inventory/health",
    settings: "/admin/inventory/settings",
    variantsIndex: "/admin/inventory/variants/index",
    metrics: "/admin/inventory/metrics",
  },
  admin: {
    stats: "/admin/stats",
  },
  cms: {
    preview: {
      generateToken: "/admin/cms/preview/tokens",
      validateToken: (token: string) =>
        `/admin/cms/preview/tokens/${token}/validate`,
    },
    contentTypes: {
      list: "/admin/cms/content-types",
      detail: (id: string) => `/admin/cms/content-types/${id}`,
      create: "/admin/cms/content-types",
      update: (id: string) => `/admin/cms/content-types/${id}`,
      delete: (id: string) => `/admin/cms/content-types/${id}`,
      entries: (id: string) => `/admin/cms/content-types/${id}/entries`,
    },
    entries: {
      list: (contentTypeId: string) =>
        `/admin/cms/content-types/${contentTypeId}/entries`,
      detail: (id: string) => `/admin/cms/entries/${id}`,
      create: (contentTypeId: string) =>
        `/admin/cms/content-types/${contentTypeId}/entries`,
      update: (id: string) => `/admin/cms/entries/${id}`,
      delete: (id: string) => `/admin/cms/entries/${id}`,
      publish: (id: string) => `/admin/cms/entries/${id}/publish`,
      unpublish: (id: string) => `/admin/cms/entries/${id}/unpublish`,
      submitForReview: (id: string) =>
        `/admin/cms/entries/${id}/submit-for-review`,
      approve: (id: string) => `/admin/cms/entries/${id}/approve`,
      reject: (id: string) => `/admin/cms/entries/${id}/reject`,
      checkLock: (id: string) => `/admin/cms/entries/${id}/lock`,
      acquireLock: (id: string) => `/admin/cms/entries/${id}/lock`,
      releaseLock: (id: string) => `/admin/cms/entries/${id}/lock`,
      snapshots: (id: string) => `/admin/cms/entries/${id}/snapshots`,
      publishReadiness: (id: string) =>
        `/admin/cms/entries/${id}/publish-readiness`,
      revisions: (id: string) => `/admin/cms/entries/${id}/revisions`,
      restoreRevision: (id: string, revisionId: string) =>
        `/admin/cms/entries/${id}/revisions/${revisionId}/restore`,
    },
    routeRegistry: {
      slugs: (
        entityType: "product" | "collection" | "cms_page",
        pattern?: string,
        locale?: string,
      ) => {
        const params = new URLSearchParams({ entityType });
        if (pattern) params.set("pattern", pattern);
        if (locale) params.set("locale", locale);
        return `/admin/cms/route-registry/slugs?${params.toString()}`;
      },
      list: "/admin/cms/route-registry",
    },
    dashboard: {
      stats: "/admin/cms/dashboard/stats",
    },
    themes: {
      list: "/admin/cms/themes",
      detail: (themeId: string) => `/admin/cms/themes/${themeId}`,
      settings: (themeId: string) => `/admin/cms/themes/${themeId}/settings`,
      activate: (themeId: string) => `/admin/cms/themes/${themeId}/activate`,
    },
  },
  orders: {
    list: "/admin/orders",
    detail: (id: string) => `/admin/orders/${id}`,
    timeline: (id: string) => `/admin/orders/${id}/timeline`,
    tracking: (id: string) => `/admin/orders/${id}/tracking`,
    reconcile: (paymentIntentId: string) =>
      `/admin/orders/reconcile/${paymentIntentId}`,
    markPaid: (id: string) => `/admin/orders/${id}/mark-paid`,
    refund: (id: string) => `/admin/orders/${id}/refund`,
    refunds: (id: string) => `/admin/orders/${id}/refunds`,
    notes: (id: string) => `/admin/orders/${id}/notes`,
    updateAddress: (id: string) => `/admin/orders/${id}/addresses`,
  },
  shipping: {
    shiprocketStatus: "/admin/shipping/shiprocket/status",
    shiprocketInitialize: "/admin/shipping/shiprocket/initialize",
    createShipment: "/admin/shipping/shiprocket/shipments",
    pickupLocations: "/admin/shipping/shiprocket/pickup-locations",
    courierServiceability: "/admin/shipping/shiprocket/courier-serviceability",
    trackShipment: (awb: string) =>
      `/admin/shipping/shiprocket/tracking/${awb}`,
    cancelShipment: (awb: string) => `/admin/shipping/shiprocket/cancel/${awb}`,
    listShipments: "/admin/shipping/shipments",
    getShipment: (id: string) => `/admin/shipping/shipments/${id}`,
  },
  payments: {
    razorpay: {
      status: "/admin/payments/razorpay/status",
      initialize: "/admin/payments/razorpay/initialize",
      getPayment: (paymentId: string) =>
        `/admin/payments/razorpay/payments/${paymentId}`,
      getOrder: (orderId: string) =>
        `/admin/payments/razorpay/orders/${orderId}`,
    },
  },
  invoices: {
    generate: (orderId: string) => `/admin/invoices/orders/${orderId}/generate`,
    get: (invoiceId: string) => `/admin/invoices/${invoiceId}`,
    getByOrder: (orderId: string) => `/admin/invoices/orders/${orderId}`,
    download: (invoiceId: string) => `/admin/invoices/${invoiceId}/download`,
  },
  paymentCharges: {
    list: "/admin/payment-charges",
    detail: (id: string) => `/admin/payment-charges/${id}`,
    create: "/admin/payment-charges",
    update: (id: string) => `/admin/payment-charges/${id}`,
    delete: (id: string) => `/admin/payment-charges/${id}`,
    preview: "/admin/payment-charges/preview",
  },
  currencies: {
    list: "/admin/currencies",
    active: "/admin/currencies/active",
    default: "/admin/currencies/default",
    detail: (id: string) => `/admin/currencies/${id}`,
    create: "/admin/currencies",
    update: (id: string) => `/admin/currencies/${id}`,
    delete: (id: string) => `/admin/currencies/${id}`,
    setDefault: (id: string) => `/admin/currencies/${id}/set-default`,
  },
  abandonedCheckouts: {
    list: "/admin/abandoned-checkouts",
    detail: (cartId: string) => `/admin/abandoned-checkouts/${cartId}`,
  },
  abandonedCarts: {
    stats: "/admin/abandoned-carts/stats",
    analytics: "/admin/abandoned-carts/analytics",
    recoveryStats: "/admin/abandoned-carts/recovery-stats",
  },
  customers: {
    list: "/admin/customers",
    detail: (id: string) => `/admin/customers/${id}`,
  },
  discounts: {
    list: "/admin/discounts",
    detail: (id: string) => `/admin/discounts/${id}`,
    create: "/admin/discounts",
    update: (id: string) => `/admin/discounts/${id}`,
    delete: (id: string) => `/admin/discounts/${id}`,
    driftReport: "/admin/discounts/drift-report",
    profile: "/admin/discounts/profile",
  },
  bundles: {
    list: "/admin/bundles",
    detail: (id: string) => `/admin/bundles/${id}`,
    create: "/admin/bundles",
    update: (id: string) => `/admin/bundles/${id}`,
    delete: (id: string) => `/admin/bundles/${id}`,
    sets: {
      create: (bundleId: string) => `/admin/bundles/${bundleId}/sets`,
      update: (bundleId: string, setId: string) =>
        `/admin/bundles/${bundleId}/sets/${setId}`,
      delete: (bundleId: string, setId: string) =>
        `/admin/bundles/${bundleId}/sets/${setId}`,
      items: {
        add: (bundleId: string, setId: string) =>
          `/admin/bundles/${bundleId}/sets/${setId}/items`,
        remove: (bundleId: string, setId: string, itemId: string) =>
          `/admin/bundles/${bundleId}/sets/${setId}/items/${itemId}`,
      },
    },
  },
  priceLists: {
    list: "/admin/price-lists",
    active: "/admin/price-lists/active",
    detail: (id: string) => `/admin/price-lists/${id}`,
    create: "/admin/price-lists",
    update: (id: string) => `/admin/price-lists/${id}`,
    delete: (id: string) => `/admin/price-lists/${id}`,
    addItem: (id: string) => `/admin/price-lists/${id}/items`,
    removeItem: (id: string, itemId: string) =>
      `/admin/price-lists/${id}/items/${itemId}`,
    driftReport: "/admin/price-lists/drift-report",
  },
  reviews: {
    list: "/admin/reviews/search",
    pending: "/admin/reviews/pending",
    search: "/admin/reviews/search",
    approve: (reviewId: string) => `/admin/reviews/${reviewId}/approve`,
    reject: (reviewId: string) => `/admin/reviews/${reviewId}/reject`,
    delete: (reviewId: string) => `/admin/reviews/${reviewId}`,
  },
  collections: {
    list: "/admin/collections",
    detail: (id: string) => `/admin/collections/${id}`,
    create: "/admin/collections",
    update: (id: string) => `/admin/collections/${id}`,
    delete: (id: string) => `/admin/collections/${id}`,
    preview: (id: string) => `/admin/collections/${id}/preview`,
    products: {
      list: (id: string) => `/admin/collections/${id}/products`,
      add: (id: string) => `/admin/collections/${id}/products`,
      remove: (id: string, productId: string) =>
        `/admin/collections/${id}/products/${productId}`,
    },
  },
  categories: {
    list: "/admin/categories",
    tree: "/admin/categories/tree",
    detail: (id: string) => `/admin/categories/${id}`,
    create: "/admin/categories",
    update: (id: string) => `/admin/categories/${id}`,
    delete: (id: string) => `/admin/categories/${id}`,
  },
  variantOptionTypes: {
    list: "/admin/products/variant-option-types",
    create: "/admin/products/variant-option-types",
    product: {
      list: (productId: string) =>
        `/admin/products/${productId}/variant-option-types`,
      create: (productId: string) =>
        `/admin/products/${productId}/variant-option-types`,
      delete: (productId: string, optionTypeId: string) =>
        `/admin/products/${productId}/variant-option-types/${optionTypeId}`,
      values: {
        create: (productId: string, optionTypeId: string) =>
          `/admin/products/${productId}/variant-option-types/${optionTypeId}/values`,
        delete: (productId: string, optionTypeId: string, valueId: string) =>
          `/admin/products/${productId}/variant-option-types/${optionTypeId}/values/${valueId}`,
      },
    },
  },
  activityLogs: {
    list: "/admin/activity-logs",
    detail: (id: string) => `/admin/activity-logs/${id}`,
  },
  customerGroups: {
    list: "/admin/customer-groups",
    active: "/admin/customer-groups/active",
    detail: (id: string) => `/admin/customer-groups/${id}`,
    create: "/admin/customer-groups",
    update: (id: string) => `/admin/customer-groups/${id}`,
    delete: (id: string) => `/admin/customer-groups/${id}`,
    assignPriceList: (id: string) =>
      `/admin/customer-groups/${id}/assign-price-list`,
    removePriceList: (id: string, priceListId: string) =>
      `/admin/customer-groups/${id}/price-lists/${priceListId}`,
    members: (id: string) => `/admin/customer-groups/${id}/members`,
  },
  tax: {
    rules: {
      list: "/admin/tax-rules",
      active: "/admin/tax-rules/active",
      detail: (id: string) => `/admin/tax-rules/${id}`,
      create: "/admin/tax-rules",
      update: (id: string) => `/admin/tax-rules/${id}`,
      delete: (id: string) => `/admin/tax-rules/${id}`,
    },
    exemptions: {
      list: "/admin/tax-exemptions",
      active: "/admin/tax-exemptions/active",
      detail: (id: string) => `/admin/tax-exemptions/${id}`,
      create: "/admin/tax-exemptions",
      update: (id: string) => `/admin/tax-exemptions/${id}`,
      delete: (id: string) => `/admin/tax-exemptions/${id}`,
    },
    hsnCodes: {
      list: "/admin/hsn-codes",
      active: "/admin/hsn-codes/active",
      detail: (id: string) => `/admin/hsn-codes/${id}`,
      create: "/admin/hsn-codes",
      update: (id: string) => `/admin/hsn-codes/${id}`,
      delete: (id: string) => `/admin/hsn-codes/${id}`,
    },
    audit: {
      list: "/admin/tax-audit",
    },
  },
  mediaHealth: {
    scan: "/admin/media/health/scan",
    fix: (action: string) => `/admin/media/health/fix/${action}`,
    auditLogs: "/admin/media/health/audit-logs",
  },
  redis: {
    health: "/admin/redis/health",
    stats: "/admin/redis/stats",
    keys: "/admin/redis/keys",
  },
  jobs: {
    list: "/admin/jobs",
    history: (jobName: string) => `/admin/jobs/${jobName}/history`,
    trigger: (jobName: string) => `/admin/jobs/${jobName}/trigger`,
    queues: {
      list: "/admin/jobs/queues",
      metrics: "/admin/jobs/queues/metrics",
      detail: (queueName: string) => `/admin/jobs/queues/${queueName}`,
      jobs: (
        queueName: string,
        status?: "waiting" | "active" | "completed" | "failed" | "delayed",
      ) => {
        const params = status ? `?status=${status}` : "";
        return `/admin/jobs/queues/${queueName}/jobs${params}`;
      },
      jobDetail: (queueName: string, jobId: string) =>
        `/admin/jobs/queues/${queueName}/jobs/${jobId}`,
      pause: (queueName: string) => `/admin/jobs/queues/${queueName}/pause`,
      resume: (queueName: string) => `/admin/jobs/queues/${queueName}/resume`,
      retryJob: (queueName: string, jobId: string) =>
        `/admin/jobs/queues/${queueName}/jobs/${jobId}/retry`,
      removeJob: (queueName: string, jobId: string) =>
        `/admin/jobs/queues/${queueName}/jobs/${jobId}`,
    },
    deadLetter: {
      list: "/admin/jobs/dead-letter",
      retry: (jobId: string) => `/admin/jobs/dead-letter/${jobId}/retry`,
    },
  },
  dashboards: {
    overview: "/admin/dashboards/overview",
    performance: "/admin/dashboards/performance",
    operations: "/admin/dashboards/operations",
    customerSupport: "/admin/dashboards/customer-support",
    productMerchandising: "/admin/dashboards/product-merchandising",
  },
  shippingMethods: {
    list: "/admin/shipping-methods",
    detail: (id: string) => `/admin/shipping-methods/${id}`,
    create: "/admin/shipping-methods",
    update: (id: string) => `/admin/shipping-methods/${id}`,
    delete: (id: string) => `/admin/shipping-methods/${id}`,
  },
  theme: {
    get: "/theme",
    css: "/theme/css",
    update: "/theme",
  },
  webhooks: {
    list: "/admin/webhooks",
    detail: (id: string) => `/admin/webhooks/${id}`,
    create: "/admin/webhooks",
    update: (id: string) => `/admin/webhooks/${id}`,
    delete: (id: string) => `/admin/webhooks/${id}`,
    test: (id: string) => `/admin/webhooks/${id}/test`,
    enable: (id: string) => `/admin/webhooks/${id}/enable`,
    disable: (id: string) => `/admin/webhooks/${id}/disable`,
    logs: (id: string) => `/admin/webhooks/${id}/logs`,
    incoming: {
      list: "/admin/webhooks/incoming",
    },
  },
  search: {
    status: "/admin/search/stats",
    reindex: "/admin/search/reindex",
    reindexStatus: "/admin/search/reindex/status",
    relevance: "/admin/search/relevance",
    updateRelevance: "/admin/search/relevance",
    resetRelevance: "/admin/search/relevance/reset",
    sync: "/admin/search/sync",
  },
  wallet: {
    customers: "/admin/wallet/customers",
    customer: (customerId: string) => `/admin/wallet/customers/${customerId}`,
    credit: (customerId: string) =>
      `/admin/wallet/customers/${customerId}/credit`,
    debit: (customerId: string) =>
      `/admin/wallet/customers/${customerId}/debit`,
    transactions: "/admin/wallet/transactions",
    rules: {
      list: "/admin/wallet/rules",
      detail: (id: string) => `/admin/wallet/rules/${id}`,
      create: "/admin/wallet/rules",
      update: (id: string) => `/admin/wallet/rules/${id}`,
      delete: (id: string) => `/admin/wallet/rules/${id}`,
    },
  },
  imports: {
    create: "/admin/imports",
    status: (jobId: string) => `/admin/imports/${jobId}`,
    errors: (jobId: string) => `/admin/imports/${jobId}/errors`,
    template: (type: string, format: "csv" | "excel" = "csv") =>
      `/admin/imports/templates/${type}?format=${format}`,
  },
  featureFlags: {
    list: "/admin/features",
    resolve: "/admin/features/resolve",
    create: "/admin/features",
    updateDefaultState: (key: string) => `/admin/features/${key}`,
    enable: (key: string) => `/admin/features/${key}/enable`,
    disable: (key: string) => `/admin/features/${key}/disable`,
    setAdminScope: (key: string, adminId: string) =>
      `/admin/features/${key}/scope/admin/${adminId}`,
    setStoreScope: (key: string, storeId: string) =>
      `/admin/features/${key}/scope/store/${storeId}`,
    setEnvScope: (key: string, envName: string) =>
      `/admin/features/${key}/scope/env/${envName}`,
    removeScope: (key: string, scopeType: string, scopeId: string) =>
      `/admin/features/${key}/scope/${scopeType}/${scopeId}`,
    history: (key: string, scopeType?: string, scopeId?: string) => {
      const params = new URLSearchParams();
      if (scopeType) params.set("scopeType", scopeType);
      if (scopeId) params.set("scopeId", scopeId);
      const query = params.toString();
      return `/admin/features/${key}/history${query ? `?${query}` : ""}`;
    },
  },
} as const;
