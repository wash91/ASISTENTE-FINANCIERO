import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./router";
import "./styles/global.css";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
