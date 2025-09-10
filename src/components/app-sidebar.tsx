
"use client";

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Wallet, Landmark, Boxes, Settings, LogOut, CreditCard, LineChart, Handshake } from 'lucide-react';
import { useAppContext } from "@/app/context/app-context";
import Logo from "./logo";
import { cn } from "@/lib/utils";

const navGroups = [
    {
        title: 'Overview',
        items: [
            { value: 'dashboard', label: 'Dashboard', icon: LineChart },
        ]
    },
    {
        title: 'Ledgers',
        items: [
            { value: 'cash', label: 'Cash', icon: Wallet },
            { value: 'bank', label: 'Bank', icon: Landmark },
            { value: 'stock', label: 'Stock', icon: Boxes },
        ]
    },
    {
        title: 'Accounts',
        items: [
            { value: 'credit', label: 'A/R & A/P', icon: CreditCard },
            { value: 'loans', label: 'Loans', icon: Handshake },
        ]
    },
    {
        title: 'System',
        items: [
            { value: 'settings', label: 'Settings', icon: Settings },
        ]
    }
];

interface AppSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export function AppSidebar({ activeTab, setActiveTab }: AppSidebarProps) {
    const { logout } = useAppContext();
    const { setOpen, isMobile, setOpenMobile } = useSidebar();

    const handleItemClick = (tab: string) => {
        setActiveTab(tab);
        if (isMobile) {
            setOpenMobile(false);
        }
    }

    return (
        <>
            <SidebarHeader>
                 <div className="flex items-center gap-3 px-2">
                    <Logo className="h-8 w-8 text-primary shrink-0" />
                    <span className="text-lg font-semibold overflow-hidden whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                        Ha-Mim Iron Mart
                    </span>
                </div>
            </SidebarHeader>
            
            <div className="flex-grow overflow-y-auto">
                {navGroups.map((group) => (
                    <SidebarGroup key={group.title}>
                        <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map(item => (
                                <SidebarMenuItem key={item.value}>
                                    <SidebarMenuButton
                                        onClick={() => handleItemClick(item.value)}
                                        isActive={activeTab === item.value}
                                        tooltip={{children: item.label}}
                                    >
                                        <item.icon className="h-5 w-5 shrink-0"/>
                                        <span className="whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                                            {item.label}
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </div>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={logout} tooltip={{children: "Logout"}}>
                            <LogOut className="h-5 w-5 shrink-0"/>
                            <span className="whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                                Logout
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </>
    )
}
