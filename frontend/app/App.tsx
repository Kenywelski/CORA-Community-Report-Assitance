import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AppProviders } from './AppProviders';
import { AppRouter } from './AppRouter';

export default function App() {
  return (
    <AppProviders>
      <Toaster />
      <Sonner />
      <AppRouter />
    </AppProviders>
  );
}
