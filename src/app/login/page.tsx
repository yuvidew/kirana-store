import { LoginForm } from "@/features/auth/_components/login-form";

/** /login — the public sign-in page. */
const LoginPage = () => {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <LoginForm />
    </div>
  );
};

export default LoginPage;
