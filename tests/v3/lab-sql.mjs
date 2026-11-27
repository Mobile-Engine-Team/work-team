import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// This helper controls dates and an offline runtime in the isolated integration database.
export function labSql(sql, values = {}) {
  if (
    process.env.WORKBENCH_TEST_LAB !== "1" ||
    (process.env.MW_V3_API &&
      process.env.MW_V3_API !== "http://127.0.0.1:19115")
  )
    throw Error("数据库样例仅支持本机 WORKBENCH_TEST_LAB=1");
  const args = [
    "-X",
    "-A",
    "-t",
    "-q",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    "127.0.0.1",
    "-p",
    "54459",
    "-U",
    "workbench",
    "-d",
    "workbench",
  ];
  for (const [key, value] of Object.entries(values))
    args.push("-v", key + "=" + value);
  return execFileSync(resolve(process.env.WORKBENCH_PG_BIN, "psql"), args, {
    encoding: "utf8",
    input: sql,
    env: {
      ...process.env,
      PGPASSWORD: readFileSync(
        resolve(
          process.env.WORKBENCH_RUNTIME || ".local/v2-runtime",
          "db-password",
        ),
        "utf8",
      ).trim(),
    },
  }).trim();
}
