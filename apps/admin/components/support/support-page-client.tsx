"use client";

import {
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Mail,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useBackendInfo } from "@/hooks/admin/use-backend-info";
import { cn } from "@/lib/utils";

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What is VCEcom?",
    answer:
      "VCEcom is a comprehensive e-commerce platform designed for managing products, orders, inventory, customers, and all aspects of your online store. It provides a powerful admin panel with role-based access control and extensive features for modern e-commerce operations.",
  },
  {
    question: "How do I manage products?",
    answer:
      "Navigate to the Products section from the sidebar. You can create new products, add variants, manage categories and collections, upload images, and set pricing. Products can be organized into bundles for special offers.",
  },
  {
    question: "How does inventory management work?",
    answer:
      "The Inventory section allows you to track stock levels across all product variants. You can view inventory health metrics, adjust stock levels, bulk adjust inventory, and monitor low stock alerts. Inventory reservations are automatically managed for pending orders.",
  },
  {
    question: "How do I process orders?",
    answer:
      "Orders can be viewed and managed in the Orders section. You can update order statuses, mark payments as received, process refunds, update shipping addresses, add notes, and track order timelines. Abandoned checkouts are also tracked separately.",
  },
  {
    question: "What are customer groups?",
    answer:
      "Customer groups allow you to segment customers and assign specific price lists to different groups. This enables personalized pricing strategies, bulk discounts, and targeted marketing campaigns.",
  },
  {
    question: "How do discounts work?",
    answer:
      "Discounts can be created with various types including percentage, fixed amount, and free shipping. You can set conditions based on products, collections, customer groups, or order subtotals. Discounts can be scheduled and have usage limits.",
  },
  {
    question: "What is role-based access control?",
    answer:
      "VCEcom supports multiple admin roles (admin, support, reviewer, marketing) with different permission levels. Admins have full access, while other roles are restricted to specific sections based on their responsibilities.",
  },
  {
    question: "How do I manage reviews?",
    answer:
      "Product reviews can be viewed, approved, rejected, or deleted in the Reviews section. Reviews go through an approval process before being displayed to customers, ensuring quality and preventing spam.",
  },
  {
    question: "What payment methods are supported?",
    answer:
      "VCEcom integrates with Razorpay for payment processing. Payment charges can be configured, and orders support both online payments and Cash on Delivery (COD) options.",
  },
  {
    question: "How do I track inventory health?",
    answer:
      "The Inventory Health page provides comprehensive metrics including total stock, available stock, low stock alerts, out of stock items, and fastest/slowest moving SKUs. This helps you make informed inventory decisions.",
  },
  {
    question: "Can I customize the store settings?",
    answer:
      "Yes, navigate to Settings to configure store information, currency settings, shipping methods, payment fees, and manage admin roles and permissions. System logs and activity logs are also available for monitoring.",
  },
  {
    question: "How do I get help or report issues?",
    answer:
      "For support, you can contact us at contact@vestcodes.co. You can also check the activity logs and audit logs in the admin panel to troubleshoot issues. For technical problems, check the system logs section.",
  },
];

function FAQItem({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-border/50 bg-card/30 p-3 text-left transition-all duration-200 hover:bg-card/50",
            isOpen && "bg-card/50",
          )}
        >
          <span className="text-xs font-medium pr-4">{item.question}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.answer}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SupportPageClient() {
  const { data: backendInfo, isLoading, error } = useBackendInfo();

  return (
    <AdminPageLayout
      title="Support"
      description="Software information and support resources"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Software Info */}
        <div className="space-y-6">
          {/* Software Version */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Software Version</CardTitle>
              <CardDescription className="text-xs">
                Current platform version and build information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                  <div className="h-4 w-48 bg-muted/30 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-muted/30 rounded animate-pulse" />
                </div>
              ) : error ? (
                <div className="text-xs text-destructive">
                  Failed to load version information
                </div>
              ) : backendInfo ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      Platform version:{" "}
                    </span>
                    <span className="font-medium">{backendInfo.version}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Build date: </span>
                    <span className="font-medium">
                      {formatDate(backendInfo.buildDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Release type:{" "}
                    </span>
                    <span className="font-medium capitalize">
                      {backendInfo.buildEnv}
                    </span>
                  </div>
                  {backendInfo.commitHash && (
                    <div>
                      <span className="text-muted-foreground">Commit: </span>
                      <span className="font-mono font-medium">
                        {backendInfo.commitHash}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Creator */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Creator</CardTitle>
              <CardDescription className="text-xs">
                Information about the software creator
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 text-xs">
              <div className="font-medium">Vestcodes Co.</div>
              <div className="text-muted-foreground">
                <div>Imlichatti, Muzaffarpur</div>
                <div>Bihar 842001</div>
              </div>
            </CardContent>
          </Card>

          {/* Legal Links */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Legal Information</CardTitle>
              <CardDescription className="text-xs">
                Important legal documents and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start text-xs"
                >
                  <Link
                    href="https://vestcodes.co/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Privacy Policy
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start text-xs"
                >
                  <Link
                    href="https://vestcodes.co/legal/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Terms of Service
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full justify-start text-xs"
                >
                  <a href="mailto:contact@vestcodes.co">
                    <Mail className="mr-2 h-3.5 w-3.5" />
                    Contact - contact@vestcodes.co
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SOC2 Certification */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">SOC2 Type-2 Certified</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Security and compliance certification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                We are SOC2 Type-2 Certified. To request certificates, please
                contact us at{" "}
                <a
                  href="mailto:compliance@vestcodes.co"
                  className="font-medium text-foreground hover:underline"
                >
                  compliance@vestcodes.co
                </a>
                .
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start text-xs"
              >
                <a href="mailto:compliance@vestcodes.co">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Request Certificates
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* ISO 9001:2015 Certification */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">ISO 9001:2015 Certified</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Quality management system certification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                We are ISO 9001:2015 Certified. To request certificates, please
                contact us at{" "}
                <a
                  href="mailto:compliance@vestcodes.co"
                  className="font-medium text-foreground hover:underline"
                >
                  compliance@vestcodes.co
                </a>
                .
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start text-xs"
              >
                <a href="mailto:compliance@vestcodes.co">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Request Certificates
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* ISO 22301:2019 Certification */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">ISO 22301:2019 Certified</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Business continuity management certification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                We are ISO 22301:2019 Certified. To request certificates, please
                contact us at{" "}
                <a
                  href="mailto:compliance@vestcodes.co"
                  className="font-medium text-foreground hover:underline"
                >
                  compliance@vestcodes.co
                </a>
                .
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start text-xs"
              >
                <a href="mailto:compliance@vestcodes.co">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Request Certificates
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* SOC 2 Type 1 Certification */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">SOC 2 Type 1 Certified</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Security and compliance certification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                We are SOC 2 Type 1 Certified. To request certificates, please
                contact us at{" "}
                <a
                  href="mailto:compliance@vestcodes.co"
                  className="font-medium text-foreground hover:underline"
                >
                  compliance@vestcodes.co
                </a>
                .
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full justify-start text-xs"
              >
                <a href="mailto:compliance@vestcodes.co">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Request Certificates
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* License */}
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground text-center">
                Provided Under A Proprietary License
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - FAQ */}
        <div className="space-y-6">
          <Card className="rounded-xl border-border/50 bg-card/50">
            <CardHeader className="p-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">
                  Frequently Asked Questions
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Common questions about the VCEcom platform
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3">
                {faqItems.map((item) => (
                  <FAQItem key={item.question} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageLayout>
  );
}
