import { SidebarProvider } from "@/components/ui/sidebar";
import AuthProvider from "@/context/auth/authProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

interface Props {
  children: React.ReactNode;
}

export default function AppProvider({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
