import { BannedScreen } from '@/components/banned-screen';
import { useAuth } from '@/context/auth/useAuth';
import { useEnsureActiveOrg } from '@/hooks/useEnsureActiveOrg';
import AppRoutes from '@/routes/app/app.routes';
import AuthRoutes from '@/routes/auth/auth.routes';

function App() {
  const { isAuthenticated, user } = useAuth();
  useEnsureActiveOrg();

  if (!isAuthenticated) return <AuthRoutes />;

  // Banimento ativo: substitui toda a UI por uma tela com motivo+observação.
  // Considera expirado se banExpires < agora.
  if (user?.banned) {
    const expiresAt = user.banExpires ? new Date(user.banExpires) : null;
    const stillBanned = !expiresAt || expiresAt > new Date();
    if (stillBanned) return <BannedScreen />;
  }

  return <AppRoutes />;
}

export default App;
