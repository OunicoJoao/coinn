/*
 * graficos.js
 * Desenha os gráficos dos relatórios em SVG, sem biblioteca externa:
 * - barras(): um valor por mês (entradas por mês, saídas por mês)
 * - linha(): a evolução de um valor mês a mês (saldo no fim de cada mês)
 * - categorias(): barras horizontais com o total e a porcentagem de cada categoria
 *
 * As cores vêm do CSS (classes .grafico.entrada, .saida, .evolucao), então o modo noturno
 * e a impressão funcionam sem mudar nada aqui. Os textos entram com textContent
 * (nunca innerHTML), porque categorias e descrições são digitadas pelo usuário.
 *
 * Ao passar o mouse (ou focar com o Tab) em um mês, aparece uma dica com os valores.
 * Meses que ainda não terminaram aparecem hachurados: são valores previstos.
 * A tabela "Mês a mês" do relatório traz os mesmos números, para quem não enxerga o gráfico.
 */

/* exported Graficos */
const Graficos = (function () {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";

    // Medidas fixas (em pixels)
    const ALTURA = 220;
    const MARGEM = Object.freeze({ topo: 22, direita: 10, baixo: 26, esquerda: 10 });
    const LARGURA_MAX_BARRA = 24;
    const RAIO_BARRA = 4;
    const LARGURA_MIN_ROTULO = 38;   // espaço mínimo para um rótulo de mês no eixo
    const LARGURA_LETRA = 6.6;       // largura média de um caractere do eixo (fonte 11px)

    let contadorIds = 0;
    let dicaEl = null;

    // Gráficos desenhados: guarda como redesenhar cada um quando a largura mudar
    const desenhos = new WeakMap();
    const observador = typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entradas) => {
            entradas.forEach((entrada) => {
                const desenho = desenhos.get(entrada.target);
                if (desenho && Math.abs(entrada.contentRect.width - desenho.largura) > 1) {
                    desenho.desenhar();
                }
            });
        });

    // ---------- Ajudantes ----------

    function criar(nome, atributos = {}) {
        const elemento = document.createElementNS(SVG_NS, nome);
        Object.entries(atributos).forEach(([chave, valor]) => elemento.setAttribute(chave, String(valor)));
        return elemento;
    }

    function texto(conteudo, atributos) {
        const elemento = criar("text", atributos);
        elemento.textContent = conteudo;
        return elemento;
    }

    // Escala "bonita" para o eixo: limites e passos redondos (0, 500, 1.000, 1.500...)
    function escalaBonita(minimo, maximo, quantidade = 4) {
        if (minimo === maximo) {
            maximo = minimo + 1;
        }
        const bruto = (maximo - minimo) / quantidade;
        const potencia = 10 ** Math.floor(Math.log10(bruto));
        const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto);
        const inicio = Math.floor(minimo / passo) * passo;
        const fim = Math.ceil(maximo / passo) * passo;
        const marcas = [];
        for (let valor = inicio; valor <= fim + passo / 2; valor += passo) {
            marcas.push(Math.round(valor * 100) / 100);
        }
        return { minimo: inicio, maximo: fim, marcas };
    }

    // Barra com a ponta de cima (ou de baixo, se negativa) arredondada e a base reta
    function caminhoBarra(x, largura, yValor, yBase) {
        const altura = Math.abs(yBase - yValor);
        if (altura < 0.5) return "";
        const r = Math.min(RAIO_BARRA, largura / 2, altura);
        if (yValor <= yBase) {
            return `M${x},${yBase}V${yValor + r}Q${x},${yValor} ${x + r},${yValor}`
                + `H${x + largura - r}Q${x + largura},${yValor} ${x + largura},${yValor + r}V${yBase}Z`;
        }
        return `M${x},${yBase}V${yValor - r}Q${x},${yValor} ${x + r},${yValor}`
            + `H${x + largura - r}Q${x + largura},${yValor} ${x + largura},${yValor - r}V${yBase}Z`;
    }

    // Hachura diagonal usada nos meses previstos (cor = currentColor do gráfico)
    function criarHachura(id) {
        const padrao = criar("pattern", {
            id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"
        });
        padrao.append(
            criar("rect", { width: 6, height: 6, class: "grafico-hachura-fundo" }),
            criar("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "grafico-hachura-linha" })
        );
        const defs = criar("defs");
        defs.append(padrao);
        return defs;
    }

    // Prepara o container e devolve a largura disponível
    function prepararContainer(container, classe, desenhar) {
        container.classList.add("grafico", classe);
        const largura = Math.max(container.clientWidth || 0, 260);
        desenhos.set(container, { largura, desenhar });
        if (observador) observador.observe(container);
        container.replaceChildren();
        return largura;
    }

    // Margem esquerda: cabe o maior rótulo do eixo (ou quase nada, se os valores estão ocultos)
    function margemEsquerda(rotulos) {
        const maior = Math.max(0, ...rotulos.map((rotulo) => (rotulo ? rotulo.length : 0)));
        return maior ? Math.ceil(maior * LARGURA_LETRA) + 12 : MARGEM.esquerda;
    }

    // Eixo X: rótulos dos meses; com muitos meses, mostra um a cada N
    function desenharEixoX(svg, dados, centro, larguraFaixa) {
        const pulo = Math.max(1, Math.ceil(LARGURA_MIN_ROTULO / larguraFaixa));
        dados.forEach((item, indice) => {
            // O último mês sempre aparece; os outros, de N em N contando a partir do fim
            if ((dados.length - 1 - indice) % pulo !== 0) return;
            svg.append(texto(item.rotulo, {
                x: centro(indice), y: ALTURA - 8, "text-anchor": "middle", class: "grafico-eixo"
            }));
        });
    }

    // Linhas de grade horizontais e os valores do eixo Y
    function desenharGrade(svg, escala, y, esquerda, direita, formatarEixo) {
        escala.marcas.forEach((marca) => {
            svg.append(criar("line", {
                x1: esquerda, x2: direita, y1: y(marca), y2: y(marca),
                class: marca === 0 ? "grafico-base" : "grafico-grade"
            }));
            const rotulo = formatarEixo(marca);
            if (rotulo) {
                svg.append(texto(rotulo, {
                    x: esquerda - 8, y: y(marca) + 4, "text-anchor": "end", class: "grafico-eixo"
                }));
            }
        });
    }

    // Faixa invisível de cada mês: é a área de mouse/toque/foco (maior que a barra)
    function criarFaixa(x, largura, topo, altura, item, aoAtivar, aoSair) {
        const faixa = criar("rect", {
            x, y: topo, width: largura, height: altura,
            class: "grafico-faixa", tabindex: 0, role: "img", "aria-label": item.descricaoAcessivel
        });
        const mostrar = (evento) => aoAtivar(evento, faixa);
        faixa.addEventListener("pointerenter", mostrar);
        faixa.addEventListener("pointermove", mostrar);
        faixa.addEventListener("focus", mostrar);
        faixa.addEventListener("pointerleave", aoSair);
        faixa.addEventListener("blur", aoSair);
        return faixa;
    }

    // ---------- Dica (tooltip) ----------

    function obterDica() {
        if (!dicaEl) {
            dicaEl = document.createElement("div");
            dicaEl.className = "grafico-dica";
            dicaEl.setAttribute("role", "tooltip");
            dicaEl.hidden = true;
            document.body.append(dicaEl);
        }
        return dicaEl;
    }

    // linhas: [{ rotulo, valor, classe? }] - o valor vem primeiro e em destaque
    function mostrarDica(evento, alvo, titulo, linhas) {
        const dica = obterDica();
        const cabecalho = document.createElement("strong");
        cabecalho.className = "grafico-dica-titulo";
        cabecalho.textContent = titulo;

        const corpo = linhas.map(({ rotulo, valor, classe }) => {
            const linha = document.createElement("div");
            linha.className = "grafico-dica-linha";
            const chave = document.createElement("span");
            chave.className = `grafico-dica-chave ${classe || ""}`.trim();
            const numero = document.createElement("span");
            numero.className = "grafico-dica-valor";
            numero.textContent = valor;
            const nome = document.createElement("span");
            nome.className = "grafico-dica-rotulo";
            nome.textContent = rotulo;
            linha.append(chave, numero, nome);
            return linha;
        });

        dica.replaceChildren(cabecalho, ...corpo);
        dica.hidden = false;

        // Perto do ponteiro; com o teclado, embaixo do mês focado. Nunca sai da tela.
        let x;
        let y;
        if (evento && typeof evento.clientX === "number" && evento.type !== "focus") {
            x = evento.clientX + 14;
            y = evento.clientY + 14;
        } else {
            const caixa = alvo.getBoundingClientRect();
            x = caixa.left + caixa.width / 2;
            y = caixa.top + 24;
        }
        const largura = dica.offsetWidth;
        const altura = dica.offsetHeight;
        x = Math.min(x, window.innerWidth - largura - 8);
        if (y + altura > window.innerHeight - 8) y = y - altura - 28;
        dica.style.left = `${Math.max(8, x)}px`;
        dica.style.top = `${Math.max(8, y)}px`;
    }

    function esconderDica() {
        if (dicaEl) dicaEl.hidden = true;
    }

    // ---------- Gráfico de barras (um valor por mês) ----------

    // dados: [{ rotulo, valor, previsto, titulo, linhasDica, descricaoAcessivel }]
    // opcoes: { classe, descricao, formatarEixo(n) -> texto ou null, rotuloMaior(n) -> texto ou null }
    function barras(container, dados, opcoes) {
        const desenhar = () => {
            const largura = prepararContainer(container, opcoes.classe, desenhar);
            const maximo = Math.max(0, ...dados.map((item) => item.valor));
            const escala = escalaBonita(0, maximo || 1);
            const esquerda = margemEsquerda(escala.marcas.map(opcoes.formatarEixo));
            const direita = largura - MARGEM.direita;
            const larguraFaixa = (direita - esquerda) / dados.length;
            const larguraBarra = Math.max(2, Math.min(LARGURA_MAX_BARRA, larguraFaixa * 0.62));
            const y = (valor) => MARGEM.topo
                + (1 - (valor - escala.minimo) / (escala.maximo - escala.minimo)) * (ALTURA - MARGEM.topo - MARGEM.baixo);
            const centro = (indice) => esquerda + larguraFaixa * (indice + 0.5);

            const idHachura = `hachura-${++contadorIds}`;
            const svg = criar("svg", {
                width: largura, height: ALTURA, viewBox: `0 0 ${largura} ${ALTURA}`,
                role: "group", "aria-label": opcoes.descricao
            });
            svg.append(criarHachura(idHachura));
            desenharGrade(svg, escala, y, esquerda, direita, opcoes.formatarEixo);

            const indiceMaior = maximo > 0 ? dados.findIndex((item) => item.valor === maximo) : -1;
            const marcas = dados.map((item, indice) => {
                const barra = criar("path", {
                    d: caminhoBarra(centro(indice) - larguraBarra / 2, larguraBarra, y(item.valor), y(0)),
                    class: `grafico-barra${item.previsto ? " previsto" : ""}`
                });
                // Estilo inline: precisa vencer o "fill: currentColor" do CSS
                if (item.previsto) barra.style.fill = `url(#${idHachura})`;
                svg.append(barra);
                return barra;
            });

            // Rótulo seletivo: só o valor do maior mês
            const rotuloMaior = indiceMaior >= 0 ? opcoes.rotuloMaior(maximo) : null;
            if (rotuloMaior) {
                svg.append(texto(rotuloMaior, {
                    x: centro(indiceMaior), y: y(maximo) - 6, "text-anchor": "middle", class: "grafico-rotulo"
                }));
            }

            desenharEixoX(svg, dados, centro, larguraFaixa);

            dados.forEach((item, indice) => {
                svg.append(criarFaixa(
                    esquerda + larguraFaixa * indice, larguraFaixa, MARGEM.topo, ALTURA - MARGEM.topo - MARGEM.baixo, item,
                    (evento, alvo) => {
                        marcas.forEach((marca, i) => marca.classList.toggle("ativa", i === indice));
                        mostrarDica(evento, alvo, item.titulo, item.linhasDica);
                    },
                    () => {
                        marcas[indice].classList.remove("ativa");
                        esconderDica();
                    }
                ));
            });

            container.append(svg);
        };
        desenhar();
    }

    // ---------- Gráfico de linha (evolução mês a mês) ----------

    // dados e opcoes: iguais aos de barras(); rotuloMaior vira o rótulo do último ponto
    function linha(container, dados, opcoes) {
        const desenhar = () => {
            const largura = prepararContainer(container, opcoes.classe, desenhar);
            const valores = dados.map((item) => item.valor);
            const escala = escalaBonita(Math.min(0, ...valores), Math.max(0, ...valores));
            const esquerda = margemEsquerda(escala.marcas.map(opcoes.formatarEixo));
            const direita = largura - MARGEM.direita;
            const larguraFaixa = (direita - esquerda) / dados.length;
            const y = (valor) => MARGEM.topo
                + (1 - (valor - escala.minimo) / (escala.maximo - escala.minimo)) * (ALTURA - MARGEM.topo - MARGEM.baixo);
            const centro = (indice) => esquerda + larguraFaixa * (indice + 0.5);
            const pontos = dados.map((item, indice) => [centro(indice), y(item.valor)]);

            const svg = criar("svg", {
                width: largura, height: ALTURA, viewBox: `0 0 ${largura} ${ALTURA}`,
                role: "group", "aria-label": opcoes.descricao
            });
            desenharGrade(svg, escala, y, esquerda, direita, opcoes.formatarEixo);

            // Área clara entre a linha e o zero
            const caminho = (lista) => lista.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join("");
            const zero = y(0);
            svg.append(criar("path", {
                d: `${caminho(pontos)}L${pontos[pontos.length - 1][0]},${zero}L${pontos[0][0]},${zero}Z`,
                class: "grafico-area"
            }));

            // Linha cheia nos meses que já terminaram; tracejada a partir do primeiro previsto
            const primeiroPrevisto = dados.findIndex((item) => item.previsto);
            const fimRealizado = primeiroPrevisto === -1 ? pontos.length : primeiroPrevisto;
            if (fimRealizado > 0) {
                svg.append(criar("path", { d: caminho(pontos.slice(0, fimRealizado)), class: "grafico-linha" }));
            }
            if (primeiroPrevisto !== -1) {
                const inicio = Math.max(0, primeiroPrevisto - 1);
                svg.append(criar("path", { d: caminho(pontos.slice(inicio)), class: "grafico-linha previsto" }));
            }

            // Mira: linha vertical que acompanha o mês do ponteiro
            const mira = criar("line", {
                y1: MARGEM.topo, y2: ALTURA - MARGEM.baixo, class: "grafico-mira", visibility: "hidden"
            });
            svg.append(mira);

            const marcadores = pontos.map(([px, py], indice) => {
                const ponto = criar("circle", {
                    cx: px, cy: py, r: 4, class: `grafico-ponto${dados[indice].previsto ? " previsto" : ""}`
                });
                svg.append(ponto);
                return ponto;
            });

            // Rótulo seletivo: o valor do último mês, na ponta da linha
            const ultimo = dados.length - 1;
            const rotuloFinal = opcoes.rotuloMaior(dados[ultimo].valor);
            if (rotuloFinal) {
                // Acima do ponto final e do anterior, para o texto não cruzar a linha
                const [px, py] = pontos[ultimo];
                const acima = Math.min(py, ultimo > 0 ? pontos[ultimo - 1][1] : py);
                svg.append(texto(rotuloFinal, {
                    x: Math.min(px, direita - 4), y: Math.max(12, acima - 10), "text-anchor": "end", class: "grafico-rotulo"
                }));
            }

            desenharEixoX(svg, dados, centro, larguraFaixa);

            dados.forEach((item, indice) => {
                svg.append(criarFaixa(
                    esquerda + larguraFaixa * indice, larguraFaixa, MARGEM.topo, ALTURA - MARGEM.topo - MARGEM.baixo, item,
                    (evento, alvo) => {
                        mira.setAttribute("x1", pontos[indice][0]);
                        mira.setAttribute("x2", pontos[indice][0]);
                        mira.setAttribute("visibility", "visible");
                        marcadores.forEach((ponto, i) => ponto.classList.toggle("ativo", i === indice));
                        mostrarDica(evento, alvo, item.titulo, item.linhasDica);
                    },
                    () => {
                        mira.setAttribute("visibility", "hidden");
                        marcadores[indice].classList.remove("ativo");
                        esconderDica();
                    }
                ));
            });

            container.append(svg);
        };
        desenhar();
    }

    // ---------- Categorias (barras horizontais) ----------

    // itens: [{ nome, valorTexto, percentualTexto, total, detalhe, destaque }]
    // A maior categoria ocupa a barra inteira; as outras ficam proporcionais a ela.
    function categorias(container, itens, opcoes) {
        container.classList.add("grafico-categorias", opcoes.classe);
        const maior = Math.max(0, ...itens.map((item) => item.total));

        const linhas = itens.map((item) => {
            const li = document.createElement("li");
            li.className = "categoria-linha";

            const topo = document.createElement("div");
            topo.className = "categoria-topo";
            const nome = document.createElement("span");
            nome.className = "categoria-nome";
            if (item.destaque) nome.classList.add(item.destaque);
            nome.textContent = item.nome;
            nome.title = item.nome;
            const valor = document.createElement("span");
            valor.className = "categoria-valor";
            valor.textContent = item.percentualTexto ? `${item.valorTexto} · ${item.percentualTexto}` : item.valorTexto;
            topo.append(nome, valor);

            const trilho = document.createElement("div");
            trilho.className = "categoria-trilho";
            const barra = document.createElement("div");
            barra.className = "categoria-barra";
            barra.style.width = `${maior > 0 ? Math.max(1, (item.total / maior) * 100) : 0}%`;
            trilho.append(barra);

            li.append(topo, trilho);
            if (item.detalhe) {
                const detalhe = document.createElement("small");
                detalhe.className = "categoria-detalhe";
                detalhe.textContent = item.detalhe;
                li.append(detalhe);
            }
            return li;
        });

        container.replaceChildren(...linhas);
    }

    return Object.freeze({
        escalaBonita,
        barras,
        linha,
        categorias,
        esconderDica
    });
})();
