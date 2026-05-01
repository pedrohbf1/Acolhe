import { useAuth } from '@/context/auth/useAuth';
import AppRoutes from '@/routes/app/app.routes';
import AuthRoutes from '@/routes/auth/auth.routes';

function App() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <AppRoutes /> : <AuthRoutes />;
}

export default App;
