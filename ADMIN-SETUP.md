# Área de administração — Painéis & Speakers

Uma área de admin protegida por senha permite **renomear painéis, definir os
speakers de cada painel e adicionar/remover/desativar os speakers do carrossel**.
As mudanças ficam **ao vivo para todos os visitantes** (sem precisar de redeploy).

- **Link público:** `https://SEU-DOMINIO/admin`
- **Senha:** `churrasco`

---

## Como funciona

- O site continua sendo HTML estático. Ao carregar, `index.html` busca os dados
  em `/api/data` e **reconstrói** o carrossel de speakers e os speakers/títulos
  dos painéis a partir desses dados.
- Os dados vivem em **um único JSON** guardado no **Vercel Blob**
  (`forum-data.json`). O conteúdo atual do site já foi extraído para o arquivo
  semente [`forum-data.json`](forum-data.json) — ele inicializa o Blob na
  primeira vez.
- O admin (`/admin`) lê e grava esse JSON via funções serverless em `/api`.
- A senha é validada **no servidor**; o navegador guarda apenas um cookie
  assinado (HMAC), nunca a senha.

> **Segurança:** é uma senha única compartilhada, sem contas de usuário —
> adequada para um admin de evento, não é nível bancário. Quem tiver o link e a
> palavra entra.

```
index.html ──fetch──▶ /api/data ──▶ Vercel Blob (forum-data.json)
                                          ▲
/admin (admin.html) ──/api/login─────────┐│
                     ──/api/save────────▶ ┘ (exige cookie de sessão)
                     ──/api/upload──────▶ Vercel Blob (uploads/*)
```

---

## Configuração na Vercel (uma vez, ~5 min)

1. **Importar o repositório**
   - Em [vercel.com/new](https://vercel.com/new), importe o repo do GitHub.
   - Framework Preset: **Other**. Build Command: deixe **vazio**.
     Output Directory: **raiz** (`.`). Não há build — é estático + funções `/api`.

2. **Criar o Blob store**
   - No projeto: aba **Storage** → **Create Database** → **Blob** → **Continue**.
   - Acesso: **Public** (os dados do evento são públicos de qualquer forma).
   - Dê um nome e crie. Selecione este projeto para receber o token.
   - Isso injeta automaticamente a variável `BLOB_READ_WRITE_TOKEN`.

3. **Definir a senha**
   - **Settings → Environment Variables**, adicione (Production, Preview e Development):
     - `ADMIN_PASSWORD` = `churrasco`
     - *(recomendado)* `SESSION_SECRET` = uma string aleatória longa
       (mantém as sessões válidas mesmo se um dia trocar a senha).

4. **Deploy**
   - Faça o deploy (ou um redeploy se já tinha importado antes de criar o Blob).
   - Acesse `https://SEU-DOMINIO/admin`, entre com `churrasco` e edite.

A primeira chamada a `/api/data` cria o `forum-data.json` no Blob a partir da
semente. A partir daí, o Blob é a fonte da verdade.

---

## Usando o admin

- **Aba Painéis:** renomear etiqueta/título (EN+PT), editar descrição e horário,
  e gerenciar os speakers de cada painel (adicionar, remover, reordenar,
  marcar “a confirmar”). O botão *“Preencher a partir de um speaker”* copia
  nome/foto de um speaker do carrossel para a linha do painel.
- **Aba Speakers:** adicionar, remover, **desativar** (tira do carrossel sem
  apagar), editar nome/empresa/cargo (EN+PT), país (US/BR), status
  (confirmed/proposed/tbd), iniciais e fazer **upload** de foto e logo.
- **Salvar alterações** grava tudo. As mudanças aparecem para os visitantes no
  próximo carregamento da página (recarregar / nova visita).

---

## Desenvolvimento local (opcional)

```bash
npm install
npx vercel link        # vincula ao projeto da Vercel
npx vercel env pull    # baixa BLOB_READ_WRITE_TOKEN e ADMIN_PASSWORD para .env
npx vercel dev         # roda site + /api localmente
```

Sem o token do Blob, `/api/data` simplesmente devolve a semente
(`forum-data.json`) e o login usa a senha padrão `churrasco` — dá para testar a
interface, mas o **Salvar** só persiste com o Blob configurado.

### Regenerar a semente a partir do HTML

Se quiser reextrair os dados do markup estático (antes do primeiro save):

```bash
npm run extract-seed   # reescreve forum-data.json a partir de index.html
```

> Depois que o admin salvar pela primeira vez, a fonte da verdade passa a ser o
> Blob — editar `forum-data.json` não muda mais o site. Para “resetar”, apague o
> blob `forum-data.json` no painel da Vercel (Storage → seu Blob → Browser).
