import { ResponsiveAIAssistant } from "./components/ResponsiveAIAssistant";
import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "./components/auth/AuthGate";
import { UserBadge } from "./components/auth/UserBadge";

export default function App() {
  return (
    <AuthGate>
      <ResponsiveAIAssistant />
      <UserBadge />
      <Toaster position="top-center" theme="dark" />
    </AuthGate>
  );
}
