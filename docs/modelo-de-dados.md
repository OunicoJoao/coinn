# Modelo de Dados

> Atualizado na Sprint 4: novos campos `categoria`, `subcategoria` e `dataModificacao`.

O Coinn não usa banco de dados. As movimentações ficam em uma lista em formato JSON, salva no **localStorage** do navegador na chave `coinn.movimentacoes` (ADR 01). A preferência de mostrar ou ocultar valores fica em outra chave, `coinn.valoresVisiveis`, e o tema escolhido (`"claro"` ou `"escuro"`) fica em `coinn.tema`. "Limpar tudo" apaga só as movimentações; as preferências continuam.

## Entidade: Movimentação

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `id` | número | sim | Gerado com `Date.now()` no momento do registro; único |
| `tipo` | texto | sim | `"entrada"` ou `"saida"` |
| `valor` | número | sim | Positivo, de 0,01 a 999.999,99, com até 2 casas decimais |
| `data` | texto | sim | `AAAA-MM-DD`, uma data que existe no calendário |
| `descricao` | texto | sim | De 1 a 30 caracteres |
| `categoria` | texto | não | Texto livre, até 20 caracteres; `""` quando não informada |
| `subcategoria` | texto | não | Texto livre, até 20 caracteres; `""` quando não informada. Só pode existir se houver categoria |
| `dataModificacao` | texto | não | Data e hora (ISO 8601) da última edição; só existe em movimentações editadas |

Exemplo:

```json
{
  "id": 1792005471997,
  "tipo": "saida",
  "valor": 450.5,
  "data": "2026-10-12",
  "descricao": "Mercado do mês",
  "categoria": "Alimentação",
  "subcategoria": "Mercado"
}
```

### Categorias e subcategorias

- **Não há lista fixa.** O usuário digita a categoria e a subcategoria que quiser, e o formulário sugere as que ele já usou. As sugestões de subcategoria são só as da categoria digitada.
- **Grafia única:** se já existe "Alimentação" e o usuário digita "alimentação", a movimentação é salva como "Alimentação". Isso evita categorias repetidas no filtro. A subcategoria segue a mesma regra, dentro da categoria.
- **Hierarquia de dois níveis:** a subcategoria pertence à categoria. "Mercado" dentro de "Alimentação" é diferente de "Mercado" dentro de outra categoria.

Movimentações registradas antes da Sprint 4 não têm os campos `categoria` e `subcategoria`. Não foi preciso migrar os dados: ao carregar, o código preenche os campos com `""` (`Regras.normalizarMovimentacao`), e essas movimentações aparecem no filtro como **"Sem categoria"**.

### Movimentações futuras

Não existe um campo novo: **a data decide**. Uma movimentação com `data` depois de hoje é **futura**.

- O **saldo atual** e os totais de entradas e saídas da visão Geral consideram só as movimentações com data até hoje (inclusive).
- O **saldo previsto** considera todas, inclusive as futuras.
- Quando o dia da data chega, a movimentação passa a contar no saldo atual sozinha, sem precisar editar nada.

Efeito em dados antigos: se alguém já tinha registrado uma movimentação com data futura, ela deixa de contar no saldo atual (passa a contar só no previsto).

### Visão mensal

Para um mês `AAAA-MM`, são calculados (`Regras.calcularResumoMensal`):

| Valor | Como é calculado |
|---|---|
| Entradas e saídas do mês | Movimentações com data dentro do mês, inclusive as futuras |
| Resultado do mês | Entradas do mês − saídas do mês |
| Saldo no início do mês | Saldo acumulado de tudo antes do dia 1 |
| Saldo no fim do mês | Saldo acumulado até o último dia do mês. É "previsto" se o mês ainda não acabou |

Sempre vale: saldo no fim = saldo no início + resultado do mês.

### Filtro De/Até do histórico

Na visão mensal, o histórico tem os filtros **De** e **Até** (`dataInicio` e `dataFim` em `Regras.filtrarMovimentacoes`). Eles mudam **só a lista e o resumo do histórico**; o card de saldo e o mês do navegador continuam iguais.

- As duas datas entram no período, e ele pode atravessar meses. Para ver um dia só, as duas datas são iguais. A data final não pode ser antes da inicial (`Regras.validarPeriodo`).
- Com De/Até preenchidos, a lista mostra o período no lugar do mês do navegador. Tipo, categoria e subcategoria continuam valendo.
- O resumo do histórico mostra as entradas, as saídas e o resultado **das movimentações da lista**, e o **saldo na data final** (de todas as movimentações até aquele dia, `Regras.calcularResumoPeriodo`): "Saldo previsto em" se a data ainda não chegou, "Saldo em" se já passou.

## Dados calculados (não armazenados)

O **saldo**, o **saldo previsto**, os **resumos mensais**, o **total de entradas**, o **total de saídas** e o **total do filtro** são calculados a partir da lista sempre que a tela é atualizada. A lista de categorias e subcategorias dos filtros e das sugestões também é calculada a partir das movimentações. Guardar esses valores poderia deixá-los fora de sincronia.

## Arquivo de exportação

```json
{
  "app": "coinn",
  "versao": 2,
  "exportadoEm": "2026-10-28T21:23:57.185Z",
  "movimentacoes": [ ... ]
}
```

- **Versão 1** (Sprint 3): movimentações sem `categoria` e `subcategoria`
- **Versão 2** (Sprint 4): com `categoria`, `subcategoria` e `dataModificacao`

A importação aceita as duas versões. Uma subcategoria sem categoria é descartada (a movimentação é importada sem ela), e movimentações com categoria ou subcategoria acima de 20 caracteres são ignoradas.
