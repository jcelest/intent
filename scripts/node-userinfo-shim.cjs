// Test-runner compatibility for Windows Node builds where uv_os_get_passwd fails.
// This runs before tsx and only replaces os.userInfo when the native call throws.
const os = require("node:os");

// Parser-only tests import modules that also expose database-backed workers.
// A syntactically valid, non-routable URL prevents eager client construction
// from failing; the tests never execute a query.
process.env.DATABASE_URL ||= "postgresql://intent_test:intent_test@127.0.0.1:1/intent_test";

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "intent-test",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  });
}
