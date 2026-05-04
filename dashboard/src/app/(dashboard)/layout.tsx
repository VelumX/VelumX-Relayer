import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsProvider } from "@/components/providers/StatsProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardLayout>
            <StatsProvider>
                {children}
            </StatsProvider>
        </DashboardLayout>
    );
}
