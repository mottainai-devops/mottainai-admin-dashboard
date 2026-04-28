import { useSimpleAuth as useAuth } from "@/contexts/SimpleAuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { ClipboardList, FileText, RefreshCw, LogOut, PanelLeft, Eye } from "lucide-react";
import { CSSProperties, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import PickupRecords from "@/pages/PickupRecords";
import BillingReports from "@/pages/BillingReports";
import BillingReconciliation from "@/pages/BillingReconciliation";

const viewerMenuItems = [
  { icon: ClipboardList, label: "Pickup Records", key: "pickups" },
  { icon: FileText, label: "Billing Reports", key: "billing-reports" },
  { icon: RefreshCw, label: "Billing Reconciliation", key: "billing-reconciliation" },
];

const SIDEBAR_WIDTH_KEY = "viewer-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function ViewerDashboard() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <ViewerDashboardContent setSidebarWidth={setSidebarWidth}>
        {null}
      </ViewerDashboardContent>
    </SidebarProvider>
  );
}

function ViewerDashboardContent({ setSidebarWidth }: { setSidebarWidth: (w: number) => void; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();

  // Determine active section from URL hash or default to pickups
  const hashSection = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  const validSections = ["pickups", "billing-reports", "billing-reconciliation"];
  const [activeSection, setActiveSection] = useState<string>(
    validSections.includes(hashSection) ? hashSection : "pickups"
  );

  const handleNav = (key: string) => {
    setActiveSection(key);
    window.history.replaceState(null, "", `#${key}`);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "pickups":
        return <PickupRecords />;
      case "billing-reports":
        return <BillingReports />;
      case "billing-reconciliation":
        return <BillingReconciliation />;
      default:
        return <PickupRecords />;
    }
  };

  const activeItem = viewerMenuItems.find(i => i.key === activeSection);

  return (
    <>
      <div className="relative">
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 pl-2 w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 group">
                  <img src={APP_LOGO} className="h-8 w-8 rounded-md object-cover ring-1 ring-border" alt="Logo" />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-accent rounded-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <PanelLeft className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={APP_LOGO} className="h-8 w-8 rounded-md object-cover ring-1 ring-border shrink-0" alt="Logo" />
                    <div className="min-w-0">
                      <span className="font-semibold tracking-tight truncate block">{APP_TITLE}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Viewer Portal
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors shrink-0"
                  >
                    <PanelLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {viewerMenuItems.map(item => {
                const isActive = activeSection === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNav(item.key)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">Viewer</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground">
                {activeItem?.label ?? APP_TITLE}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">
          {renderContent()}
        </main>
      </SidebarInset>
    </>
  );
}
