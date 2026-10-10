# BR/USA Real Estate Forum

Site do fórum. HTML estático, sem build e sem backend.

## Rodar localmente

```bash
npm run dev
```

Abre em `http://localhost:4321`. Outra porta: `npm run dev 5000`.

O servidor espelha o `cleanUrls` da Vercel, então `/full` resolve `full.html`, e
desliga o cache — editou, recarregou, viu.

## Publicar

Push na `main`. O deploy é automático.

## Páginas

| Arquivo | O que é |
|---|---|
| `index.html` | Site público |
| `full.html` | Versão com o carrossel de speakers e os speakers de cada painel |
| `partnerships.html` | Deck de patrocínio |
| `first-edition.html` | Deck da primeira edição |

## Onde mexer

**Programação.** No `index.html` e no `full.html`, dentro de
`<div class="schedule-list">`. Cada bloco é um `.schedule-item` com etiqueta,
horário, título em EN e PT e, quando é painel, descrição. Os dois arquivos
precisam ser editados juntos.

A lista curta `01 — … 05 —` do card do Fórum fica em `.card-panel-list`, no
mesmo arquivo, e precisa acompanhar.

**Speakers.** Só no `full.html`. O carrossel é `.speakers-track`; os cards são
duplicados de propósito, porque a animação usa `translateX(-50%)` para emendar o
loop. Mexeu num card, mexa na cópia. Quem senta em cada painel fica em
`.schedule-speakers`, dentro do `.schedule-item` do painel.

Sem foto, o card cai nas iniciais. Fotos vão em `img/speakers/`, logos em
`img/logos/`.

**Bilíngue.** Quase todo texto aparece duas vezes, em
`<span data-lang="en">` e `<span data-lang="pt">`. O botão EN/PT mostra um e
esconde o outro. Texto novo sem o par fica visível nos dois idiomas.

**PDFs (brochure e deck de patrocínio).** Os templates ficam em `pdf/`, em inglês:
`brochure.html` (A4 retrato) e `partnerships.html` (16:9). `npm run pdf` gera os
dois com o Chrome instalado na máquina; `npm run pdf -- brochure` ou
`npm run pdf -- partnerships` gera só um. Com `--preview`, também salva um PNG
por página em `pdf/preview/` para conferir o layout. A fonte e os logos dos
co-organizadores vêm do `index.html`.

O conteúdo dos PDFs não acompanha o site sozinho: programação, speakers e números
estão escritos nos templates. Mudou no site, mude no template e gere de novo.
O botão "Download the Brochure" na capa do `index.html` e do `full.html` baixa
`pdf/BRUSA-Real-Estate-Forum-2026.pdf`, então commite o PDF novo junto.

**Prévia do link (WhatsApp, LinkedIn etc.).** Tags `og:*` no `<head>` do
`index.html`. A imagem é `img/og-share-1200x630.jpg`. Para trocar, substitua o arquivo
mantendo JPEG abaixo de 300 KB, senão o WhatsApp não mostra. Se mudar as
dimensões, atualize `og:image:width` e `og:image:height`. O WhatsApp guarda a
prévia em cache, então um link já enviado pode continuar mostrando a versão antiga.
Ao trocar a imagem, suba o `?v=` no fim da URL nas três tags para forçar os
apps a buscar a versão nova.

**Artes de divulgação.** `npm run share` gera, a partir da capa do `index.html`,
a prévia do link (`img/og-share-1200x630.jpg`), a capa do evento no Luma
(`artes/luma-1080x1080.jpg` e `artes/luma-2160x2160.png`) e o backdrop do telão
(`artes/backdrop-3840x2160.png`, 16:9). `npm run share -- luma` gera só uma
(`og`, `luma` ou `backdrop`). Usa o Chrome da máquina, como o `npm run pdf`.
Parceiro novo na capa entra nas artes ao rodar de novo; o tamanho de cada logo
em cada formato fica em `scripts/build-share.mjs`, e um logo novo precisa de
uma linha lá. O fundo de Manhattan vem de `pdf/assets/`. Depois de gerar,
suba o `?v=` das tags da prévia e faça o upload da arte do Luma na página do
evento, que é manual.
