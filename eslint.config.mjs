import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  js.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 限制行长度，超过100个字符时发出警告
      "max-len": ["warn", {
        "code": 100,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true,
        "ignoreComments": true
      }],

      // 禁止空行中有空格
      "no-trailing-spaces": ["error", {
        "skipBlankLines": false, // 不跳过空行的检查
        "ignoreComments": false  // 注释中也不允许有尾随空格
      }]
    }
  }
];

export default eslintConfig;
