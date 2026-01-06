"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Logo } from "@/components/common/logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHasRole } from "@/hooks/admin/use-permissions";
import { useNavState } from "@/hooks/use-nav-state";
import type { NavItem, NavSection } from "@/lib/navigation";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./admin-shell";
import { NavLink } from "./nav-link";
import { SidebarSection } from "./sidebar-section";

interface SidebarProps {
  className?: string;
}

// Component to filter navigation items based on roles
function FilteredNavigation() {
  // Check all possible roles upfront
  const hasAdmin = useHasRole("admin");
  const hasSupport = useHasRole("support");
  const hasReviewer = useHasRole("reviewer");
  const hasMarketing = useHasRole("marketing");

  // Helper function to check if user can access a nav item
  const canAccessNavItem = useMemo(() => {
    return (item: NavItem): boolean => {
      // If no required roles, allow access
      if (!item.requiredRoles || item.requiredRoles.length === 0) {
        return true;
      }

      // Check if user has any of the required roles
      return item.requiredRoles.some((role) => {
        switch (role) {
          case "admin":
            return hasAdmin;
          case "support":
            return hasSupport;
          case "reviewer":
            return hasReviewer;
          case "marketing":
            return hasMarketing;
          default:
            return false;
        }
      });
    };
  }, [hasAdmin, hasSupport, hasReviewer, hasMarketing]);

  // Filter navigation based on user roles
  const filteredNavigation = useMemo(() => {
    return navigation
      .map((section) => {
        const filteredItems = section.items
          .map((item) => {
            // Filter children if they exist
            const filteredChildren = item.children
              ? item.children.filter((child) => canAccessNavItem(child))
              : undefined;

            // If item has children, show parent if any child is accessible
            if (
              item.children &&
              filteredChildren &&
              filteredChildren.length > 0
            ) {
              return {
                ...item,
                children: filteredChildren,
              };
            }

            // If item has no children or all children filtered out, check parent access
            if (canAccessNavItem(item)) {
              return item;
            }

            return null;
          })
          .filter((item): item is NavItem => item !== null);

        // Only include section if it has items
        if (filteredItems.length === 0) {
          return null;
        }

        return {
          ...section,
          items: filteredItems,
        };
      })
      .filter((section): section is NavSection => section !== null);
  }, [canAccessNavItem]);

  return (
    <>
      {filteredNavigation.map((section, sectionIndex) => {
        // Check if this section should use flyout (has label and multiple items)
        const shouldUseFlyout = section.label && section.items.length > 1;

        if (shouldUseFlyout) {
          return (
            <NavFlyoutGroup
              key={`nav-section-${String(sectionIndex)}`}
              label={section.label}
              items={section.items}
            />
          );
        }

        return (
          <div
            key={`nav-section-${String(sectionIndex)}`}
            className="space-y-1"
          >
            {section.label && (
              <div className="px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {section.label}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarSection key={item.href} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Nav Flyout Group Component
 *
 * Major groups with flyout navigation:
 * - Opens flyout on hover/click
 * - Shows sub-items in popover
 * - Clean, predictable structure
 */
function NavFlyoutGroup({
  label,
  items,
}: {
  label?: string;
  items: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Check if any child is active
  const hasActiveChild = items.some((item) => {
    if (item.href === pathname) return true;
    return item.children?.some((child) => child.href === pathname);
  });

  // Get the main item (first item or item with matching href)
  const mainItem = items[0];
  const subItems = items.slice(1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
            "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            hasActiveChild && "text-foreground bg-accent/50",
          )}
        >
          {mainItem.icon && <mainItem.icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="flex-1 text-left">{label || mainItem.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-56 p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-1">
          {/* Main item */}
          <NavLink
            href={mainItem.href}
            icon={mainItem.icon}
            label={mainItem.label}
            badge={mainItem.badge}
            onClick={() => setOpen(false)}
          />
          {/* Sub items */}
          {subItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              onClick={() => setOpen(false)}
            />
          ))}
          {/* Children items */}
          {mainItem.children?.map((child) => (
            <NavLink
              key={child.href}
              href={child.href}
              icon={child.icon}
              label={child.label}
              badge={child.badge}
              isChild
              onClick={() => setOpen(false)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const { isCollapsed } = useNavState();
  const sidebar = useSidebar();
  const isMobileOpen = sidebar?.isMobileOpen ?? false;
  const setIsMobileOpen = sidebar?.setIsMobileOpen ?? (() => {});

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen border-r border-border/50 bg-sidebar transition-all duration-300 lg:static lg:z-auto",
          "w-64", // Always full width on mobile, collapsed state only applies on desktop
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed && "lg:w-16", // Only apply collapsed width on desktop
          !isCollapsed && "lg:w-64", // Full width on desktop when not collapsed
          className,
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
            <Link
              href="/"
              className={cn(
                "flex items-center",
                isCollapsed && "justify-center w-full",
              )}
            >
              {isCollapsed ? (
                <Logo width={32} height={32} showText={false} />
              ) : (
                <Logo width={120} height={28} />
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="space-y-4 p-4">
              <FilteredNavigation />
            </nav>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
