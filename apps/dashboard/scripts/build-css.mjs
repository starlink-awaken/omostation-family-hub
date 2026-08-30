import postcss from "postcss";
import tailwindPlugin from "@tailwindcss/postcss";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src", "styles", "tailwind.src.css");
const dest = path.join(root, "src", "styles", "tailwind.generated.css");

const raw = await fs.readFile(src, "utf8");

const result = await postcss([tailwindPlugin()]).process(raw, {
  from: src,
});

await fs.writeFile(dest, result.css);
console.log(`✓ Tailwind CSS built: ${path.relative(root, dest)} (${result.css.length} bytes)`);
