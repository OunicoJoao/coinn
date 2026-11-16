# Roteiro de Testes Manuais (Sprint 4)

Roteiro para testar o Coinn como um usuário real. Cada testador executa os passos e marca o resultado. Quando o resultado for diferente do esperado, registre um **Bug** no Azure Boards com os passos para reproduzir, o resultado esperado, o resultado obtido e um print.

**Testador:** ______________  **Data:** ___/___/______
**Dispositivo e navegador:** ______________ (ex.: celular Android, Chrome)

Antes de começar: abra o Coinn, aperte F12 > Console e rode `localStorage.removeItem("coinn.movimentacoes")` para partir do zero. No celular, use uma aba anônima.

## 1. Registrar movimentação

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 1.1 | Registre uma Entrada de 3500, categoria "Trabalho", subcategoria "Salário", descrição "Salário" | Aparece no histórico em verde; saldo R$ 3.500,00 | |
| 1.2 | Registre uma Saída de 450,50, categoria "Alimentação", subcategoria "Mercado", descrição "Mercado do mês" | Aparece em vermelho, com a etiqueta "Alimentação › Mercado"; saldo R$ 3.049,50 | |
| 1.3 | Tente registrar sem valor | Mensagem "Informe um valor maior que zero." | |
| 1.4 | Registre uma movimentação sem categoria e sem subcategoria | É registrada normalmente, sem etiqueta | |
| 1.4b | Preencha só a subcategoria, sem categoria | Mensagem "Informe a categoria antes da subcategoria." | |
| 1.4c | Digite "alimentação" (minúsculo) na categoria e registre | Fica como "Alimentação", a grafia que já existia | |
| 1.4d | Digite "Alimentação" na categoria e clique na subcategoria | Aparece "Mercado" como sugestão | |
| 1.5 | Tente digitar uma descrição com mais de 30 caracteres | O campo para em 30 e o contador mostra 30/30 | |
| 1.6 | Registre uma Entrada de 0,30 e duas Saídas de 0,10 e 0,20 (em um Coinn vazio) | Saldo R$ 0,00, sem sinal de menos e sem cor vermelha | |

## 2. Saldo e histórico

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 2.1 | Registre movimentações em datas diferentes | O histórico mostra a data mais recente primeiro | |
| 2.2 | Recarregue a página (F5) | Tudo continua lá | |
| 2.3 | Digite `<b>teste</b>` como descrição e registre | O texto aparece exatamente assim, sem ficar em negrito | |

## 2b. Movimentações futuras

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 2b.1 | No formulário, escolha uma data depois de hoje | Aparece o aviso "Data futura: entra no saldo previsto..." embaixo do campo | |
| 2b.2 | Registre uma Saída de 1000 com data no mês que vem | O saldo do topo **não** muda; aparece "Previsto: ... · com 1 movimentação futura" | |
| 2b.3 | Veja o item no histórico | Borda tracejada e selo "Futura" ao lado da data | |
| 2b.4 | Registre uma movimentação com a data de hoje | Conta no saldo atual normalmente, sem selo "Futura" | |
| 2b.5 | Edite a futura e mude a data para hoje | Ela passa a contar no saldo atual e perde o selo | |

## 2c. Visão mensal

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 2c.1 | Clique na aba "Mensal" | Aparece o mês atual (‹ Mês de Ano ›); o filtro "Mês" do histórico some | |
| 2c.2 | Confira o card | "Previsto para o fim de <mês>", entradas e saídas do mês, "Início do mês" e "Resultado do mês" | |
| 2c.3 | Confira a conta | Saldo do fim do mês = início do mês + resultado do mês | |
| 2c.4 | Clique em ‹ para ir a um mês passado | O título vira "Saldo no fim de <mês>" e aparece o botão "Mês atual" | |
| 2c.5 | Vá para o mês da saída futura do passo 2b.2 | Ela aparece no histórico do mês e nas saídas do mês | |
| 2c.6 | Vá para um mês sem movimentações | "Nenhuma movimentação em <Mês de Ano>."; o saldo do fim é igual ao do início | |
| 2c.7 | Na visão mensal, filtre por uma categoria e clique em "Limpar filtros" | O filtro sai, mas continua no mesmo mês | |
| 2c.8 | Clique na aba "Geral" | Volta a mostrar tudo, com o saldo atual | |

## 2d. Filtro De/Até no histórico (visão mensal)

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 2d.1 | Na aba Geral, olhe os filtros | Não aparecem De e Até | |
| 2d.2 | Na aba Mensal, anote o card de saldo e preencha só o "De" | O "Até" recebe a mesma data; a lista mostra só aquele dia; **o card e o mês não mudam** | |
| 2d.3 | Mude o "Até" para o mês que vem | A lista mostra as movimentações do período, inclusive do outro mês; o resumo mostra entradas, saídas, resultado e "Saldo previsto em <data>" | |
| 2d.4 | Confira o resumo | "Saldo previsto em <Até>" é igual ao saldo do card na visão Mensal ao navegar até aquele dia | |
| 2d.5 | Combine com uma categoria | A lista e as entradas/saídas do resumo respeitam a categoria | |
| 2d.6 | Coloque o "Até" antes do "De" | Mensagem "A data final não pode ser antes da inicial."; a lista não muda | |
| 2d.7 | Clique em "Limpar filtros" | De e Até ficam vazios e a lista volta para o mês | |

## 3. Editar e excluir

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 3.1 | Clique em ✎ em uma movimentação, mude o valor e salve | O item e o saldo são atualizados | |
| 3.2 | Clique em ✎ e depois em "Cancelar edição" | Nada muda; o formulário volta para "Nova movimentação" | |
| 3.3 | Clique em × e cancele a confirmação | A movimentação continua lá | |
| 3.4 | Clique em × e confirme | A movimentação some e o saldo é atualizado | |

## 3b. Excluir várias

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 3b.1 | Marque a caixinha ao lado do × em duas movimentações | Aparece a barra "2 selecionadas · <total>" com "Selecionar todas", "Cancelar" e "Excluir 2" | |
| 3b.2 | Aperte Esc (ou clique em "Cancelar") | As caixinhas são desmarcadas e a barra some | |
| 3b.3 | Marque uma movimentação e depois filtre para ela sumir da lista | Ela deixa de estar selecionada (nada escondido é excluído) | |
| 3b.4 | Filtre por uma categoria e clique em "Selecionar todas" | Só as movimentações que aparecem são marcadas | |
| 3b.5 | Clique em "Excluir N" e cancele a confirmação | Nada é excluído | |
| 3b.6 | Clique em "Excluir N" e confirme | Somem todas as selecionadas; aviso "N movimentações excluídas."; saldo atualizado | |

## 4. Filtros

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 4.1 | Filtre por Tipo: Saídas | Só aparecem saídas; aparece "Total no filtro"; o saldo do topo não muda | |
| 4.2 | Combine Mês e Categoria | Só aparecem as movimentações que atendem aos dois filtros | |
| 4.2b | Com Categoria "Todas", tente usar o filtro de Subcategoria | Ele fica desativado | |
| 4.2c | Escolha a categoria "Alimentação" e depois a subcategoria "Mercado" | Só aparecem as movimentações de Alimentação › Mercado | |
| 4.2d | Escolha a categoria "Sem categoria" | Só aparecem as movimentações sem categoria | |
| 4.3 | Escolha uma combinação sem resultado | Mensagem "Nenhuma movimentação encontrada com esses filtros." | |
| 4.4 | Clique em "Limpar filtros" | Todas as movimentações voltam | |

## 5. Ocultar valores

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 5.1 | Clique no olho | Todos os valores viram "R$ •••••", inclusive o total do filtro | |
| 5.2 | Recarregue a página | Os valores continuam ocultos | |
| 5.3 | Clique no olho de novo | Os valores voltam | |

## 5b. Modo noturno

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 5b.1 | Clique no botão de lua, ao lado do olho | A página fica roxa, cinza e preta; o ícone vira um sol | |
| 5b.2 | Recarregue a página | Abre direto no modo noturno, sem piscar no tema claro | |
| 5b.3 | No modo noturno, registre, edite e filtre uma movimentação | Textos, valores em verde/vermelho e campos continuam legíveis | |
| 5b.4 | Clique em "Limpar tudo" e confirme | O modo noturno continua ativo | |
| 5b.5 | Clique no sol | Volta para o tema claro, igual ao de antes | |

## 6. Exportar, importar e limpar tudo

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 6.1 | Exportar / Importar > Exportar dados > Exportar (com "Tudo" marcado) | Baixa um arquivo `coinn-movimentacoes-AAAA-MM-DD.json` | |
| 6.2 | Clique em "Limpar tudo" e confirme | Histórico vazio e saldo R$ 0,00 | |
| 6.3 | Importe o arquivo baixado no passo 6.1 (Exportar / Importar > Importar dados > Importar) | Todas as movimentações voltam, com categorias e subcategorias | |
| 6.4 | Tente importar um arquivo que não é da Coinn (ex.: uma imagem renomeada para .json) | Mensagem de erro; nada é alterado | |

## 6b. Exportar e importar por período

Prepare movimentações em pelo menos dois anos (ex.: algumas em 2025 e algumas no ano atual, incluindo uma data futura).

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 6b.1 | Exportar / Importar > Exportar dados | Abre o diálogo com "Tudo" marcado e um resumo (quantidade, entradas, saídas, resultado) | |
| 6b.2 | Escolha "Mês", um mês com movimentações, e exporte | Baixa `coinn-movimentacoes-AAAA-MM.json` só com aquele mês; nada some da Coinn | |
| 6b.3 | Escolha "Vários meses" com o mês final antes do inicial | Mensagem "O mês final não pode ser antes do inicial." e o botão fica desativado | |
| 6b.4 | Escolha "Ano" = ano atual | "Remover..." fica desativado, explicando que só dá para remover meses que já terminaram | |
| 6b.5 | Anote o saldo. Escolha "Ano" = ano passado, marque "Remover..." e deixe "Manter o saldo igual" marcado | Mostra quanto espaço libera e o ajuste que será criado ("Saldo de 2025", no dia 31/12) | |
| 6b.6 | Desmarque "Manter o saldo igual" | Aparece o alerta de que o saldo vai mudar. Marque de novo | |
| 6b.7 | Clique em "Exportar e remover" e confirme | Baixa `coinn-movimentacoes-2025.json`; as movimentações do ano somem do histórico; aparece "Saldo de 2025" (categoria "Ajuste de saldo"); o **saldo é o mesmo** do passo 6b.5 | |
| 6b.8 | Importe o arquivo do passo 6b.7 (Incorporar, Tudo) | A prévia diz "N novas" e que o ajuste sai. Ao importar, as movimentações voltam, o ajuste some e o saldo continua o mesmo | |
| 6b.9 | Importe o mesmo arquivo de novo | "Nada novo: tudo isso já está na Coinn." e o botão Importar desativado | |
| 6b.10 | Edite o arquivo num editor de texto (mude o valor de uma movimentação) e importe | Aparece a lista de conflitos ("valor: R$ X → R$ Y"); o botão só libera depois de escolher "Manter as minhas" ou "Usar as do arquivo" | |
| 6b.11 | Escolha "Usar as do arquivo" e importe | O valor muda na Coinn; nada fica duplicado | |
| 6b.12 | Importe um arquivo escolhendo "Mês" e "Substituir só o período escolhido" | Só as movimentações daquele mês são trocadas; os outros meses ficam iguais | |
| 6b.13 | Importe com "Substituir todos os meus dados" e clique em Cancelar no aviso | Nada muda | |
| 6b.14 | Importe um arquivo exportado antes (versão 2, da Sprint 4) | Funciona normalmente | |

## 6c. Relatórios

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 6c.1 | Clique na aba "Relatórios" | Some o saldo, o histórico e o formulário; aparece o relatório do ano atual | |
| 6c.2 | Confira os cartões | Entradas, saídas, resultado ("Guardou X% das entradas") e saldo no fim, com a comparação com o ano anterior | |
| 6c.3 | Passe o mouse (ou use Tab) nos meses dos gráficos | Aparece a dica com o mês e os valores; meses que ainda não terminaram aparecem hachurados e com "(previsto)" | |
| 6c.4 | Confira a tabela "Mês a mês" | Mesmos números dos gráficos; saldo no fim de cada mês = fim do mês anterior + resultado | |
| 6c.5 | Troque o período: Mês, Vários meses (atravessando o ano), Últimos 12 meses e Tudo | Tudo se atualiza; com vários anos, os meses aparecem como "Jan/26" | |
| 6c.6 | Escolha um período sem movimentações | Mensagem "Nenhuma movimentação em ..." | |
| 6c.7 | Confira "Saídas por categoria" | Da maior para a menor, com porcentagem e subcategorias; "Sem categoria" em itálico | |
| 6c.8 | Clique no olho | Os valores e os eixos dos gráficos ficam ocultos; as porcentagens continuam | |
| 6c.9 | Clique em "Baixar planilha (CSV)" e abra no Excel | Colunas certas, acentos corretos, uma linha por mês e a linha "Total" | |
| 6c.10 | Clique em "Imprimir / PDF" (também no modo noturno) | A prévia de impressão mostra só o relatório, com cores claras | |
| 6c.11 | Ative o modo noturno | Gráficos, cartões e tabela continuam legíveis | |

## 7. Celular

| # | Passos | Resultado esperado | OK? |
|---|---|---|---|
| 7.1 | Abra no celular | O formulário aparece antes do histórico; não há rolagem para os lados | |
| 7.2 | Repita os passos 1.1, 3.1 e 4.1 | Funcionam igual ao computador | |
| 7.3 | Abra a aba Relatórios e os diálogos de exportar e importar | Tudo cabe na tela, sem rolagem para os lados; os botões dos diálogos ficam um embaixo do outro | |

## Observações do testador

(Dificuldades, sugestões, algo confuso na tela)
