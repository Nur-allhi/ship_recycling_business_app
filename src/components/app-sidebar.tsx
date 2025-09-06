
"use client";

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarContent,
} from "@/components/ui/sidebar";
import { Wallet, Landmark, Boxes, Settings, LogOut, CreditCard, LineChart, Handshake, PanelLeft } from 'lucide-react';
import { useAppContext } from "@/app/context/app-context";
import Logo from "./logo";

const navItems = [
    { value: 'dashboard', label: 'Dashboard', icon: LineChart },
    { value: 'cash', label: 'Cash', icon: Wallet },
    { value: 'bank', label: 'Bank', icon: Landmark },
    { value: 'credit', label: 'A/R & A/P', icon: CreditCard },
    { value: 'stock', label: 'Stock', icon: Boxes },
    { value: 'loans', label: 'Loans', icon: Handshake },
    { value: 'settings', label: 'Settings', icon: Settings },
];

interface AppSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export function AppSidebar({ activeTab, setActiveTab }: AppSidebarProps) {
    const { logout, user } = useAppContext();

    return (
        <>
            <SidebarHeader>
                 <div className="flex items-center gap-2">
                    <Logo className="h-8 w-8 text-primary" />
                    <span className="text-lg font-semibold">Ha-Mim Iron Mart</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {navItems.map(item => (
                        <SidebarMenuItem key={item.value}>
                            <SidebarMenuButton 
                                onClick={() => setActiveTab(item.value)}
                                isActive={activeTab === item.value}
                            >
                                <item.icon />
                                <span>{item.label}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={logout}>
                            <LogOut />
                            <span>Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </>
    )
}
