# Modelo de Dados

> Atualizado na Sprint 4: novos campos `categoria`, `subcategoria` e `dataModificacao`.
> Atualizado com os relatórios e o exportar/importar por período: campo `ajuste`, arquivo de exportação v3 e dados dos relatórios.

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
| `ajuste` | objeto | não | `{ inicio, fim, quantidade }`: só existe no **Ajuste de saldo** (veja abaixo) |

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

### Períodos de meses

Relatórios, exportação e importação usam um **período de meses** `{ inicio, fim }` (`AAAA-MM`, os dois incluídos), escolhido como (`Regras.resolverPeriodo`):

| Escolha | Período |
|---|---|
| Mês | o mês escolhido |
| Vários meses | do mês "De" ao mês "Até" (o final não pode ser antes do inicial) |
| Ano | janeiro a dezembro do ano |
| Últimos 12 meses (só relatórios) | os 12 meses que terminam no mês de hoje |
| Tudo | do primeiro ao último mês que tem movimentação |

### Ajuste de saldo

Ao **exportar e remover** um período, as movimentações dele saem da Coinn. Como o saldo é a soma de tudo, o saldo de hoje mudaria. Para evitar isso, a Coinn cria (se o usuário deixar marcado "Manter o saldo igual") uma movimentação **Ajuste de saldo** com o resultado do período (`Regras.criarAjusteDeSaldo`):

| Campo | Valor |
|---|---|
| `tipo` e `valor` | entrada se o resultado do período foi positivo, saída se foi negativo; valor = resultado sem sinal |
| `data` | último dia do período (ex.: `2025-12-31`) |
| `descricao` | `Saldo de 2025`, `Saldo de 03/2025` ou `Saldo de 01/2025 a 03/2025` |
| `categoria` | `Ajuste de saldo` |
| `ajuste` | `{ "inicio": "2025-01", "fim": "2025-12", "quantidade": 100 }` |

Regras:

- Só dá para remover **meses que já terminaram** (`Regras.validarRemocaoDoPeriodo`): o mês atual e os seguintes ainda mudam.
- Se o resultado do período for zero, não é criado ajuste.
- Nos relatórios, o ajuste **não conta como entrada nem saída** (nem nas categorias e médias), mas **entra no saldo**.
- Ao **importar de volta** o arquivo daquela exportação, com o período inteiro, o ajuste é **desfeito** automaticamente (`Regras.ajustesDesfeitos`), porque as movimentações originais voltam. Se a importação traz só uma parte do período, o ajuste fica e a tela avisa que os valores podem contar em dobro (`Regras.ajustesSobrepostos`).

### Relatórios

Calculados por `Relatorios.gerarRelatorio(lista, periodo, hoje)`; nada é armazenado.

| Dado | Como é calculado |
|---|---|
| Entradas, saídas e resultado | Movimentações do período, sem os ajustes de saldo |
| Saldo no início / no fim | Saldo acumulado de tudo antes do primeiro dia / até o último dia do período |
| Meses | Um item por mês do período (inclusive meses vazios): entradas, saídas, resultado e saldo no fim do mês. Meses que ainda não terminaram são **previstos** |
| Médias | Entradas e saídas divididas pelo número de meses do período; valor médio de cada saída |
| Taxa de economia | Resultado ÷ entradas (quanto das entradas sobrou) |
| Comparação | O mesmo número de meses logo antes do período (Jan–Jun compara com Jul–Dez do ano anterior) |
| Categorias | Total, porcentagem e subcategorias; depois de 6, o resto vira "Outras" |

## Dados calculados (não armazenados)

O **saldo**, o **saldo previsto**, os **resumos mensais**, o **total de entradas**, o **total de saídas** e o **total do filtro** são calculados a partir da lista sempre que a tela é atualizada. A lista de categorias e subcategorias dos filtros e das sugestões também é calculada a partir das movimentações. Guardar esses valores poderia deixá-los fora de sincronia.

## Arquivo de exportação

```json
{
  "app": "coinn",
  "versao": 3,
  "exportadoEm": "2026-11-10T15:00:00.000Z",
  "periodo": { "inicio": "2025-01", "fim": "2025-12" },
  "resumo": { "quantidade": 100, "entradas": 64320, "saidas": 42244.8, "resultado": 22075.2 },
  "movimentacoes": [ ... ]
}
```

- **Versão 1** (Sprint 3): movimentações sem `categoria` e `subcategoria`
- **Versão 2** (Sprint 4): com `categoria`, `subcategoria` e `dataModificacao`
- **Versão 3** (relatórios e exportar/importar por período): com o `periodo` exportado, um `resumo` e o campo `ajuste`

Nome do arquivo: `coinn-movimentacoes-AAAA-MM-DD.json` (tudo), `coinn-movimentacoes-2025-03.json` (um mês), `coinn-movimentacoes-2025.json` (um ano) ou `coinn-movimentacoes-2025-01_a_2025-03.json` (vários meses).

A importação aceita as três versões e também um arquivo que seja só a lista de movimentações.

### Como a importação junta os dados

O usuário escolhe o período do arquivo que quer trazer e um destes modos (`Regras.aplicarImportacao`):

| Modo | O que acontece |
|---|---|
| **Incorporar** (padrão) | Nada é apagado. Cada movimentação do arquivo é comparada com as atuais (`Regras.compararImportacao`): **igual** (mesmo `id` e mesmo conteúdo, ou outro `id` com o mesmo tipo, valor, data, descrição, categoria e subcategoria) fica de fora; **nova** é adicionada; **conflito** (mesmo `id`, algum campo diferente) é mostrado ao usuário, que escolhe "Manter as minhas" ou "Usar as do arquivo". Sem conflitos, a incorporação é direta |
| **Substituir o período** | Apaga as movimentações atuais daquele período e coloca as do arquivo; o resto fica igual |
| **Substituir tudo** | Apaga tudo e fica só com o arquivo (pede confirmação) |

Em qualquer modo, uma subcategoria sem categoria é descartada (a movimentação é importada sem ela), e movimentações inválidas (por exemplo, com categoria ou subcategoria acima de 20 caracteres) são ignoradas e contadas no aviso.

