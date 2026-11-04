/*
 * regras.test.js
 * Testes automatizados das regras de negócio (js/regras.js).
 * Rodar com: npm test   (ou: node --test)
 *
 * Usa o executor de testes que já vem no Node (node:test), sem instalar nada.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Regras = require("../js/regras.js");

const { TIPO } = Regras;

// Cria uma movimentação válida; cada teste muda só o campo que interessa
function mov(campos = {}) {
    return {
        id: 1,
        tipo: TIPO.ENTRADA,
        valor: 100,
        data: "2026-10-14",
        descricao: "Salário",
        ...campos
    };
}

const ids = (lista) => lista.map((m) => m.id);

describe("validarMovimentacao", () => {
    it("aceita uma movimentação válida", () => {
        assert.equal(Regras.validarMovimentacao(mov()), null);
    });

    it("recusa tipo diferente de entrada ou saída", () => {
        assert.match(Regras.validarMovimentacao(mov({ tipo: "transferencia" })), /entrada ou uma saída/);
    });

    it("recusa valor zero, negativo ou que não é número", () => {
        assert.match(Regras.validarMovimentacao(mov({ valor: 0 })), /maior que zero/);
        assert.match(Regras.validarMovimentacao(mov({ valor: -10 })), /maior que zero/);
        assert.match(Regras.validarMovimentacao(mov({ valor: NaN })), /maior que zero/);
    });

    it("aceita os limites de valor e recusa acima do máximo", () => {
        assert.equal(Regras.validarMovimentacao(mov({ valor: 0.01 })), null);
        assert.equal(Regras.validarMovimentacao(mov({ valor: 999999.99 })), null);
        assert.match(Regras.validarMovimentacao(mov({ valor: 1000000 })), /valor máximo/);
    });

    it("recusa descrição vazia ou só com espaços", () => {
        assert.match(Regras.validarMovimentacao(mov({ descricao: "" })), /descrição/);
        assert.match(Regras.validarMovimentacao(mov({ descricao: "   " })), /descrição/);
    });

    it("aceita descrição com 30 caracteres e recusa com 31", () => {
        assert.equal(Regras.validarMovimentacao(mov({ descricao: "a".repeat(30) })), null);
        assert.match(Regras.validarMovimentacao(mov({ descricao: "a".repeat(31) })), /no máximo 30/);
    });
});

describe("dataValida (defeito corrigido na Sprint 4)", () => {
    it("aceita datas reais, inclusive 29 de fevereiro em ano bissexto", () => {
        assert.equal(Regras.dataValida("2026-10-14"), true);
        assert.equal(Regras.dataValida("2028-02-29"), true);
    });

    it("recusa datas que não existem no calendário", () => {
        assert.equal(Regras.dataValida("2026-13-45"), false);
        assert.equal(Regras.dataValida("2026-02-31"), false);
        assert.equal(Regras.dataValida("2026-02-29"), false);
    });

    it("recusa formatos errados", () => {
        assert.equal(Regras.dataValida("14/10/2026"), false);
        assert.equal(Regras.dataValida(""), false);
        assert.equal(Regras.dataValida(undefined), false);
    });
});

describe("calcularResumo", () => {
    it("lista vazia dá tudo zero", () => {
        assert.deepEqual(Regras.calcularResumo([]), { entradas: 0, saidas: 0, saldo: 0 });
    });

    it("soma entradas, saídas e calcula o saldo", () => {
        const lista = [
            mov({ id: 1, valor: 2500.5 }),
            mov({ id: 2, tipo: TIPO.SAIDA, valor: 100.2 }),
            mov({ id: 3, tipo: TIPO.SAIDA, valor: 0.1 })
        ];
        assert.deepEqual(Regras.calcularResumo(lista), { entradas: 2500.5, saidas: 100.3, saldo: 2400.2 });
    });

    it("saldo zerado com centavos não fica negativo (defeito corrigido na Sprint 4)", () => {
        // Antes: 0.3 - (0.1 + 0.2) = -0.0000000000000000555 e a tela mostrava "-R$ 0,00" em vermelho
        const lista = [
            mov({ id: 1, valor: 0.3 }),
            mov({ id: 2, tipo: TIPO.SAIDA, valor: 0.1 }),
            mov({ id: 3, tipo: TIPO.SAIDA, valor: 0.2 })
        ];
        const { saldo } = Regras.calcularResumo(lista);
        assert.equal(saldo, 0);
        assert.equal(saldo < 0, false);
    });

    it("saldo pode ser negativo", () => {
        const lista = [mov({ valor: 50 }), mov({ id: 2, tipo: TIPO.SAIDA, valor: 80 })];
        assert.equal(Regras.calcularResumo(lista).saldo, -30);
    });
});

describe("adicionarMovimentacao", () => {
    it("adicionar devolve uma lista nova, com valor arredondado e textos sem espaços nas pontas", () => {
        const original = [];
        const nova = Regras.adicionarMovimentacao(
            original,
            mov({ valor: 10.456, descricao: "  Café  " }),
            99
        );
        assert.equal(original.length, 0, "a lista original não pode ser alterada");
        assert.deepEqual(nova[0], {
            ...mov({ valor: 10.46, descricao: "Café" }),
            id: 99
        });
    });
});

describe("histórico: ordenação", () => {
    const lista = [
        mov({ id: 1, data: "2026-09-30", tipo: TIPO.ENTRADA }),
        mov({ id: 2, data: "2026-10-05", tipo: TIPO.SAIDA }),
        mov({ id: 3, data: "2026-10-05", tipo: TIPO.SAIDA }),
        mov({ id: 4, data: "2026-10-20", tipo: TIPO.SAIDA }),
        mov({ id: 5, data: "2026-10-21", tipo: TIPO.ENTRADA })
    ];

    it("ordena da data mais recente para a mais antiga; no mesmo dia, a registrada por último primeiro", () => {
        assert.deepEqual(ids(Regras.ordenarHistorico(lista)), [5, 4, 3, 2, 1]);
    });

    it("ordenar não altera a lista original", () => {
        Regras.ordenarHistorico(lista);
        assert.deepEqual(ids(lista), [1, 2, 3, 4, 5]);
    });
});

describe("formatação", () => {
    it("formata moeda em real", () => {
        // O Intl usa um espaço especial (não quebrável) entre "R$" e o número
        assert.equal(Regras.formatarMoeda(2400.2).replace(/\s/g, " "), "R$ 2.400,20");
    });

    it("formata data em português", () => {
        assert.equal(Regras.formatarData("2026-10-14"), "14/10/2026");
    });

    it("dataISO usa o dia local, sem pular para o dia anterior", () => {
        assert.equal(Regras.dataISO(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
    });
});
