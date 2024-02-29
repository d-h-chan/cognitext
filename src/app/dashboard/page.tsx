import Dashboard from "@/components/Dashboard";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";

// '/dashboard' route, contain list of user's PDF files
const Page = async () => {

  // check for logged in user session
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user || !user?.id) redirect("/auth-callback?origin=dashboard");

  // check for user in db
  const dbUser = await db.user.findFirst({
    where: {
      id: user?.id,
    },
  });
  if (!dbUser) redirect("/auth-callback?origin=dashboard");

  return <Dashboard />;
};

export default Page;
