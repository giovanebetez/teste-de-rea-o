# REACTION TEST — Laboratório Breaking Bad

Minijogo web de velocidade de reação em milissegundos inspirado em **Breaking Bad**, com visual escuro moderno, detalhes em azul cristal (*Blue Sky*), recordes salvos em `localStorage` e suporte a ranking global com **Neon Postgres** na **Vercel**.

## Funcionalidades

- **5 tentativas por partida** com intervalo aleatório entre 2 e 5 segundos antes do sinal verde.
- **Medição precisa em milissegundos** usando `performance.now()` + `requestAnimationFrame` e captura via `pointerdown` (zero atraso em mouse, toque ou tecla Espaço).
- **Detecção de clique antecipado**: exibe `"Muito cedo! Você clicou antes da hora"` e permite repetir a tentativa.
- **Relatório completo**: média das 5 tentativas, melhor reação da partida, detalhamento individual de cada tentativa e classificação temática Breaking Bad (*Heisenberg*, *Gustavo Fring*, *Mike Ehrmantraut*, *Jesse Pinkman*, *Saul Goodman*, *Badger & Skinny Pete*).
- **Persistência local**: melhor tempo pessoal e melhor média salvos automaticamente em `localStorage`.
- **Ranking Global (Neon Postgres)**: ao configurar `DATABASE_URL`, a tabela `reaction_scores` é criada automaticamente e os jogadores podem registrar sua média no Top 10 global.

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Banco de dados Neon (Opcional / Produção)

Conecte um banco **Neon Postgres** via Vercel Marketplace (`vercel install neon`) ou defina `DATABASE_URL` no `.env.local`. A rota `/api/scores` inicializa o schema automaticamente no primeiro uso.
