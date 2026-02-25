import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/server/auth/session";

export default function HomePage() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME);

  if (sessionToken) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}

