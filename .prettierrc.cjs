/** @type {import("prettier").Options} */
const config = {
    trailingComma: "es5",
    tabWidth: 4,

    plugins: ["@trivago/prettier-plugin-sort-imports"],

    importOrder: ["^node:.*$", "^@(.*)$", "^[./]"],
    importOrderParserPlugins: ["typescript", "decorators-legacy"],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
};

module.exports = config;
