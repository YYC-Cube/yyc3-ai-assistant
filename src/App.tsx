import { ResponsiveAIAssistant } from "./components/ResponsiveAIAssistant";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <>
      <ResponsiveAIAssistant />
      <Toaster position="top-center" theme="dark" />
    </>
  );
}
