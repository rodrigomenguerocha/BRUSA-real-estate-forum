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

A lista curta `01 — … 06 —` do card do Fórum fica em `.card-panel-list`, no
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

**Prévia do link (WhatsApp, LinkedIn etc.).** Tags `og:*` no `<head>` do
`index.html`. A imagem é `img/og-share.jpg`. Para trocar, substitua o arquivo
mantendo JPEG abaixo de 300 KB, senão o WhatsApp não mostra. Se mudar as
dimensões, atualize `og:image:width` e `og:image:height`. O WhatsApp guarda a
prévia em cache, então um link já enviado pode continuar mostrando a versão antiga.
