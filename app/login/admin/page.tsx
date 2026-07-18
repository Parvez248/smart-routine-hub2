import RoleLoginForm from "../RoleLoginForm";

export default function AdminLoginPage() {
  return (
    <RoleLoginForm
      role="ADMIN"
      heading="Administration Login"
      description="Sign in with your administrator account."
      note="Administrator accounts are created by the department."
    />
  );
}
