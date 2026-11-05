/*
 * eslint.config.js
 * Configuração do ESLint: verificação automática de padrão e de erros comuns no código.
 * Rodar com: npm run lint
 */

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    // Regras recomendadas pelo ESLint (variável não declarada, código inalcançável etc.)
    js.configs.recommended,

    // Regras do projeto, para todos os arquivos
    {
        rules: {
            eqeqeq: "error",          // sempre === e !==, nunca == e !=
            "no-var": "error",        // usar let/const em vez de var
            "prefer-const": "error",  // const quando a variável nunca muda
            "no-unused-vars": ["error", { caughtErrors: "none" }]
        }
    },

    // Código do site: roda no navegador como script comum (sem import/export)
    {
        files: ["js/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...globals.browser,
                // usado só para permitir carregar os arquivos nos testes do Node
                module: "readonly"
            }
        }
    },

    // Testes e este arquivo de configuração: rodam no Node
    {
        files: ["tests/**/*.js", "eslint.config.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: globals.node
        }
    }
];
