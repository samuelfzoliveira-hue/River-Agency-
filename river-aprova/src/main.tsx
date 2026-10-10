import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";

// Link de recuperação de senha: se o e-mail abrir em outra rota, leva para a tela de nova senha.
if (window.location.hash.includes("type=recovery") && window.location.pathname !== "/redefinir-senha") {
  window.location.replace(`/redefinir-senha${window.location.hash}`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
