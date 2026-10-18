import { Button } from "@/components/ui/button";
import { logoutAction } from "../actions";

export function LogoutButton({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size={size}>
        Sign out
      </Button>
    </form>
  );
}
