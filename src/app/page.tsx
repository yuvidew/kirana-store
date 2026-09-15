import { redirect } from "next/navigation";

/**
 * / has no content of its own — always redirects to /dashboard, and
 * `proxy.ts` then bounces unauthenticated visitors on to /login.
 */
const Home = () => {
  redirect("/dashboard");
};

export default Home;
