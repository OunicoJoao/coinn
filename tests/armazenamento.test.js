/*
 * armazenamento.test.js
 * Testes da camada de armazenamento (js/storage.js).
 * Rodar com: npm test   (ou: node --test)
 *
 * O Node não tem localStorage, então os testes usam um "localStorage falso"
 * (um dublê de teste) que guarda os dados num objeto Map em memória.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Dublê do localStorage do navegador
function criarLocalStorageFalso() {
    const dados = new Map();
    return {
        getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
        setItem: (chave, valor) => dados.set(chave, String(valor)),
        removeItem: (chave) => dados.delete(chave)
    };
}

// O storage.js usa "localStorage" como variável global, igual ao navegador
globalThis.localStorage = criarLocalStorageFalso();
const Armazenamento = require("../js/storage.js");

// Durante os testes de erro, esconde as mensagens de console.error do relatório
function semConsoleError(funcao) {
    const original = console.error;
    console.error = () => {};
    try {
        return funcao();
    } finally {
        console.error = original;
    }
}

describe("Armazenamento", () => {
    beforeEach(() => {
        globalThis.localStorage = criarLocalStorageFalso();
    });

    it("sem nada salvo, carrega uma lista vazia", () => {
        assert.deepEqual(Armazenamento.carregarMovimentacoes(), []);
    });

    it("salva e carrega a mesma lista", () => {
        const lista = [{ id: 1, tipo: "entrada", valor: 10, data: "2026-10-14", descricao: "Teste" }];
        assert.equal(Armazenamento.salvarMovimentacoes(lista), true);
        assert.deepEqual(Armazenamento.carregarMovimentacoes(), lista);
    });

    it("usa a chave do projeto no localStorage", () => {
        Armazenamento.salvarMovimentacoes([]);
        assert.equal(localStorage.getItem("coinn.movimentacoes"), "[]");
    });

    it("ignora dados corrompidos em vez de quebrar o app", () => {
        localStorage.setItem("coinn.movimentacoes", "{isso não é json");
        assert.deepEqual(semConsoleError(() => Armazenamento.carregarMovimentacoes()), []);

        localStorage.setItem("coinn.movimentacoes", '{"nao":"é lista"}');
        assert.deepEqual(Armazenamento.carregarMovimentacoes(), []);
    });

    it("avisa (retorna false) quando o navegador não deixa salvar", () => {
        localStorage.setItem = () => {
            throw new Error("QuotaExceededError");
        };
        assert.equal(semConsoleError(() => Armazenamento.salvarMovimentacoes([])), false);
    });

    it("limpar tudo apaga as movimentações", () => {
        Armazenamento.salvarMovimentacoes([{ id: 1 }]);

        assert.equal(Armazenamento.removerTodasMovimentacoes(), true);
        assert.deepEqual(Armazenamento.carregarMovimentacoes(), []);
    });
});
