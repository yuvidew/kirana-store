import { LoginForm } from "@/features/auth/_components/login-form";
import { LoginBrandPanel } from "./_components/login-brand-panel";

/** /login — the public sign-in page. */
const LoginPage = () => {
  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      <LoginBrandPanel />
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
