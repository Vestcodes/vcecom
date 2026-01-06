"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  deviceId: z.string().min(1, "Device ID is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  // Check if redirected due to expired token
  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setError("Your session has expired. Please log in again.");
      setErrorDialogOpen(true);
    }
  }, [searchParams]);

  // Show dialog when error changes
  useEffect(() => {
    if (error) {
      setErrorDialogOpen(true);
    }
  }, [error]);

  // Generate device ID once on mount
  const [deviceId] = useState(() => {
    if (typeof window === "undefined") return "";
    // Try to get existing device ID from localStorage, or generate new one
    const stored = localStorage.getItem("admin_device_id");
    if (stored) return stored;
    const newDeviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("admin_device_id", newDeviceId);
    return newDeviceId;
  });

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      deviceId: deviceId,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      // Call Next.js API route which proxies to backend and forwards cookies
      // This ensures cookies are set for the admin app domain, not backend domain
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies in request/response
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || "Login failed");
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      return response.json() as Promise<{
        accessToken: string;
        refreshToken: string;
        id: string;
        email: string;
        role: string;
        requires2fa: boolean;
      }>;
    },
    onSuccess: async (data) => {
      if (data.requires2fa) {
        // Handle 2FA flow (to be implemented)
        setError(
          "2FA verification required. This feature is not yet implemented.",
        );
        return;
      }

      // Store tokens (cookies are set by backend via API route)
      if (data.accessToken) {
        setAuthToken(data.accessToken);
      }

      // Get redirect destination
      const redirectTo = searchParams.get("redirect") || "/";

      // Ensure we're redirecting to a relative path (security)
      const redirectPath = redirectTo.startsWith("/")
        ? redirectTo
        : `/${redirectTo}`;

      // Use window.location.replace for a full page reload to ensure cookies are sent
      // Replace instead of href to avoid adding to browser history
      // The cookies are set by the API route response with httpOnly flag,
      // so they'll be automatically included in the next request
      // A delay ensures the browser has processed the Set-Cookie headers from the API response
      setTimeout(() => {
        window.location.replace(redirectPath);
      }, 500);
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(error.message || "An error occurred during login");
      }
      setErrorDialogOpen(true);
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setError(null);
    setErrorDialogOpen(false);
    mutation.mutate(data);
  };

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center">
              <Logo width={140} height={36} />
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Welcome To Admin Panel
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sign in to access the account area
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Email"
                          className="bg-muted/30 border-border/50 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Password"
                          className="bg-muted/30 border-border/50 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full text-sm"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Logging in..." : "Continue with Email"}
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                  Forgot password? -{" "}
                  <Link
                    href="/reset"
                    className="text-primary hover:underline transition-colors"
                  >
                    Reset
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Login Error</DialogTitle>
            <DialogDescription>
              {error || "An error occurred during login"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              The team at Vestcodes has been informed and is working to resolve
              this issue.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setErrorDialogOpen(false);
                setError(null);
              }}
              variant="default"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
