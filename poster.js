// Gera a imagem "música + nebulosa das 3 cores" num <canvas>
// Fundo preto ou branco, e download em JPG.

const POSTER_W = 1080;
const POSTER_H = 1350;

// Guarda o que está sendo exibido, pra poder redesenhar ao trocar o fundo
let posterEstado = null;

// Os títulos que vêm da API do YouTube chegam com entidades HTML (&amp;, &#39;...)
function decodificarHtml(texto) {
  const t = document.createElement("textarea");
  t.innerHTML = texto || "";
  return t.value;
}

// Gerador pseudoaleatório com semente: a mesma música + as mesmas cores
// sempre geram exatamente a mesma nebulosa (nos dois fundos)
function criarRandom(semente) {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) {
    h = Math.imul(h ^ semente.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Número aleatório com distribuição "de sino": a maioria perto de 0, poucos longe
function gaussiana(rand) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function desenharNebulosa(ctx, cores, rand, fundo) {
  const claro = fundo === "branco";

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = claro ? "#fff" : "#000";
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // Onde cada cor "nasce": canto sup. esquerdo, lado direito, canto inf. esquerdo
  const ancoras = [
    { x: 0.05 * POSTER_W, y: 0.12 * POSTER_H },
    { x: 1.02 * POSTER_W, y: 0.4 * POSTER_H },
    { x: 0.1 * POSTER_W, y: 0.97 * POSTER_H },
  ];

  const PONTOS_POR_COR = 45000;
  // No preto as cores se somam (lighter); no branco elas se misturam como tinta (multiply)
  ctx.globalCompositeOperation = claro ? "multiply" : "lighter";

  cores.forEach((cor, i) => {
    const { x: ax, y: ay } = ancoras[i];
    const sigmaX = POSTER_W * (0.27 + rand() * 0.06);
    const sigmaY = POSTER_H * (0.17 + rand() * 0.05);
    ctx.fillStyle = cor;

    for (let n = 0; n < PONTOS_POR_COR; n++) {
      const x = ax + gaussiana(rand) * sigmaX;
      const y = ay + gaussiana(rand) * sigmaY;
      if (x < 0 || x > POSTER_W || y < 0 || y > POSTER_H) continue;
      ctx.globalAlpha = 0.55 + rand() * 0.45;
      const tam = 2 + rand() * 1.6;
      ctx.fillRect(x, y, tam, tam);
    }
  });

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function caminhoArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function quebrarTexto(ctx, texto, larguraMax, maxLinhas) {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? atual + " " + p : p;
    if (ctx.measureText(teste).width <= larguraMax) {
      atual = teste;
    } else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);

  if (linhas.length > maxLinhas) {
    linhas.length = maxLinhas;
    let ultima = linhas[maxLinhas - 1];
    while (ultima.length > 0 && ctx.measureText(ultima + "\u2026").width > larguraMax) {
      ultima = ultima.slice(0, -1);
    }
    linhas[maxLinhas - 1] = ultima + "\u2026";
  }
  return linhas;
}

// Tenta carregar a capa de um jeito que permite baixar a imagem depois (CORS).
// Se o navegador/servidor não deixar, carrega mesmo assim só pra exibir.
function carregarImagem(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, limpo: true });
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => resolve({ img: img2, limpo: false });
      img2.onerror = () => resolve(null);
      img2.src = url;
    };
    img.src = url;
  });
}

function desenharCartao(ctx, capa, titulo, canal, fundo) {
  const claro = fundo === "branco";
  const cartaoW = Math.round(POSTER_W * 0.64);
  const capaH = Math.round((cartaoW * 9) / 16);
  const pad = 26;
  const larguraTexto = cartaoW - pad * 2;

  ctx.font = "bold 34px Arial, Helvetica, sans-serif";
  const linhasTitulo = quebrarTexto(ctx, titulo, larguraTexto, 2);
  const alturaLinha = 44;
  const textoH = pad + linhasTitulo.length * alturaLinha + (canal ? 46 : 0) + pad - 6;

  const cartaoH = capaH + textoH;
  const x = Math.round((POSTER_W - cartaoW) / 2);
  const y = Math.round((POSTER_H - cartaoH) / 2 + POSTER_H * 0.03);

  // Fundo branco do cartão, com sombra (mais leve quando o fundo é branco)
  ctx.save();
  ctx.shadowColor = claro ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#fff";
  caminhoArredondado(ctx, x, y, cartaoW, cartaoH, 18);
  ctx.fill();
  ctx.restore();

  // Capa do vídeo (cantos de cima arredondados)
  ctx.save();
  caminhoArredondado(ctx, x, y, cartaoW, cartaoH, 18);
  ctx.clip();
  if (capa) {
    ctx.drawImage(capa, x, y, cartaoW, capaH);
  } else {
    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, cartaoW, capaH);
  }
  ctx.restore();

  // Contorno fininho pra o cartão não sumir no fundo branco
  if (claro) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2;
    caminhoArredondado(ctx, x, y, cartaoW, cartaoH, 18);
    ctx.stroke();
    ctx.restore();
  }

  // Título e canal
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#0f0f0f";
  ctx.font = "bold 34px Arial, Helvetica, sans-serif";
  let ty = y + capaH + pad;
  linhasTitulo.forEach((linha) => {
    ctx.fillText(linha, x + pad, ty);
    ty += alturaLinha;
  });

  if (canal) {
    ctx.fillStyle = "#606060";
    ctx.font = "28px Arial, Helvetica, sans-serif";
    ctx.fillText(canal, x + pad, ty + 4);
  }
}

function desenharMarca(ctx, fundo) {
  ctx.save();
  ctx.fillStyle = fundo === "branco" ? "#000" : "#fff";
  ctx.font = "italic 46px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Syncthesia", POSTER_W - 40, POSTER_H - 40);
  ctx.restore();
}

// Desenha tudo de novo a partir do que está guardado em posterEstado
function renderizarPoster() {
  if (!posterEstado) return;
  const { videoId, titulo, canal, cores, capa, fundo } = posterEstado;
  const canvas = document.getElementById("posterCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = POSTER_W;
  canvas.height = POSTER_H;

  const rand = criarRandom(videoId + cores.join(""));
  desenharNebulosa(ctx, cores, rand, fundo);
  desenharCartao(ctx, capa ? capa.img : null, decodificarHtml(titulo), decodificarHtml(canal), fundo);
  desenharMarca(ctx, fundo);
}

function atualizarBotoesFundo() {
  const fundo = posterEstado ? posterEstado.fundo : "preto";
  document.getElementById("fundoPretoBtn").classList.toggle("ativo", fundo === "preto");
  document.getElementById("fundoBrancoBtn").classList.toggle("ativo", fundo === "branco");
}

function trocarFundo(fundo) {
  if (!posterEstado) return;
  posterEstado.fundo = fundo;
  atualizarBotoesFundo();
  renderizarPoster();
}

function baixarPoster() {
  if (!posterEstado) return;
  const canvas = document.getElementById("posterCanvas");
  try {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert("Não foi possível gerar a imagem para download.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "syncthesia-" + posterEstado.videoId + ".jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      "image/jpeg",
      0.92
    );
  } catch (e) {
    console.error("Download bloqueado pelo navegador:", e);
    alert("O navegador bloqueou o download dessa imagem.");
  }
}

// Função principal, chamada depois que a música é enviada com sucesso
async function mostrarPoster({ videoId, titulo, canal, cores }) {
  const area = document.getElementById("posterArea");
  const baixarBtn = document.getElementById("baixarBtn");

  const capa = await carregarImagem(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);

  // Mantém o fundo que a pessoa já tinha escolhido (padrão: preto)
  const fundo = posterEstado ? posterEstado.fundo : "preto";
  posterEstado = { videoId, titulo, canal, cores, capa, fundo };

  renderizarPoster();
  atualizarBotoesFundo();

  area.style.display = "block";
  baixarBtn.style.display = capa && capa.limpo ? "block" : "none";
  baixarBtn.onclick = baixarPoster;
  document.getElementById("fundoPretoBtn").onclick = () => trocarFundo("preto");
  document.getElementById("fundoBrancoBtn").onclick = () => trocarFundo("branco");
}
