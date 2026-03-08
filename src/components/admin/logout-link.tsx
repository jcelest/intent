"use client";

export function LogoutLink() {
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-mono text-slate-400 hover:text-red-400 transition-colors"
    >
      Log out
    </button>
  );
}
