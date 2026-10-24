# Syncthesia — site (entrar, criar conta, perfil)

## Arquivos
- `index.html`  as 4 telas (Entrar, Criar conta, Seu perfil, Início provisório)
- `tema.css`    cores, fontes e componentes do protótipo (as cores estão no topo, em `:root`)
- `app.js`      a lógica (login, cadastro, perfil, envio de foto e banner)
- `config.js`   **você preenche**: URL do projeto Supabase e chave `anon public`
- `icones/`     seus ícones, convertidos para poderem mudar de cor

## Para funcionar de verdade
1. Abra `config.js` e cole a URL do projeto e a chave **anon public** (Supabase > Project Settings > API).
   Nunca cole a `service_role` aqui.
2. No Supabase > Authentication > Providers, deixe "Email" ligado.
   Se "Confirm email" estiver ligado, quem cria a conta precisa clicar no link do e-mail antes de entrar.
3. Suba a pasta inteira no repositório do site (Vercel).
Enquanto o `config.js` estiver com `COLE_AQUI`, o site roda em **modo demonstração** (nada é salvo).

## Fontes
Você usa **Neue Machina** (textos) e **Poltik** (logo). A Neue Machina é grátis só para uso pessoal; para um site
público é preciso comprar a licença na Pangram Pangram. Sem os arquivos, o site usa Space Grotesk e Syne.
Se tiver licença, coloque na pasta `fonts/` com estes nomes (formato woff2):
`NeueMachina-Regular.woff2`, `NeueMachina-Ultrabold.woff2`, `Poltik.woff2`. Elas passam a valer sozinhas.
