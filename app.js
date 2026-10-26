// Syncthesia — entrar, criar conta e criar perfil (Supabase).
const cfg = window.SYNC_CONFIG || {};
const DEMO = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith("COLE");
const $ = (id) => document.getElementById(id);
const TELAS = ["tela-entrar", "tela-cadastro", "tela-perfil", "tela-inicio", "tela-adicionar"];
const API_URL = (cfg.API_URL || "https://meu-backend-jf73.onrender.com").replace(/\/$/, "");

// Avaliações de exemplo (modo demonstração): o feed e o "banco" falso usam a mesma lista.
const AVALIACOES_DEMO = [
  { id: "d1", musica_id: "seed-1", usuario_id: "x1", autor: { nome_usuario: "lia_discos" }, musica: { titulo: "Walkin' On The Sun", artista: "Smash Mouth", album: "All Stars Smash Hits" },
    nota: 5, critica: "Se eu pudesse ter uma música tema, seria essa.", cores: ["#E8A33D", "#7BC96F", "#F2E14C"], primeira: false, reavaliacao: true, criado_em: new Date(Date.now() - 3 * 36e5).toISOString(), pontuacao: 31, minha: null },
  { id: "d2", musica_id: "seed-2", usuario_id: "x2", autor: { nome_usuario: "bruno.vinil" }, musica: { titulo: "Something About Us", artista: "Daft Punk", album: "Discovery" },
    nota: 4.5, critica: "Na cara, não pra não estragar o funeral.", cores: ["#2B3FA8", "#1F7A4A", "#0B0B1E"], primeira: true, reavaliacao: false, criado_em: new Date(Date.now() - 2 * 864e5).toISOString(), pontuacao: 18, minha: null },
  { id: "d3", musica_id: "seed-3", usuario_id: "x3", autor: { nome_usuario: "ana_ouve" }, musica: { titulo: "Eu Ouço Vozes", artista: "Artista Exemplo", album: "Álbum Exemplo", explicita: true },
    nota: 3.5, critica: null, cores: ["#E0208F", "#00B8D9", "#F2C500"], primeira: false, reavaliacao: false, criado_em: new Date(Date.now() - 7 * 864e5).toISOString(), pontuacao: 0, minha: null }
];

// Sem config preenchido, roda com um "Supabase de mentira" só para ver as telas.
function clienteDemo() {
  const usuarios = [], perfis = [], ouvintes = [], arquivos = {};
  const avaliacoes = AVALIACOES_DEMO;
  let sessao = null;
  const emitir = (e) => ouvintes.forEach((f) => f(e, sessao));
  return {
    auth: {
      async getSession() { return { data: { session: sessao } }; },
      onAuthStateChange(f) { ouvintes.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
      async signUp({ email, password }) {
        if (usuarios.some((u) => u.email === email)) return { data: {}, error: { message: "User already registered" } };
        const u = { id: "demo-" + (usuarios.length + 1), email, password };
        usuarios.push(u); sessao = { user: { id: u.id, email } }; emitir("SIGNED_IN");
        return { data: { user: { id: u.id }, session: sessao }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const u = usuarios.find((x) => x.email === email && x.password === password);
        if (!u) return { data: {}, error: { message: "Invalid login credentials" } };
        sessao = { user: { id: u.id, email } }; emitir("SIGNED_IN");
        return { data: { session: sessao }, error: null };
      },
      async signOut() { sessao = null; emitir("SIGNED_OUT"); return { error: null }; }
    },
    from(tabela) {
      if (tabela === "avaliacoes") return { insert(l) { return { select() { return { async single() {
        const eu = sessao.user.id, antes = avaliacoes.filter((a) => a.musica_id === l.musica_id);
        const linha = { ...l, id: "demo-a-" + (avaliacoes.length + 1), usuario_id: eu, eh_primeira_da_musica: antes.length === 0,
          eh_reavaliacao: antes.some((a) => a.usuario_id === eu) };
        avaliacoes.unshift({ id: linha.id, musica_id: l.musica_id, usuario_id: eu, autor: null,
          musica: MUSICAS_DEMO.find((m) => "demo-musica-" + m.deezer_id === l.musica_id) || { titulo: "Música", artista: "", album: "" },
          nota: l.nota, critica: l.critica, cores: [l.cor1, l.cor2, l.cor3].map((x) => x.toUpperCase()),
          primeira: linha.eh_primeira_da_musica, reavaliacao: linha.eh_reavaliacao, criado_em: new Date().toISOString(), pontuacao: 0, minha: null });
        return { data: linha, error: null };
      } }; } }; } };
      return {
        select() { return { eq(_c, id) { return { async maybeSingle() { return { data: perfis.find((p) => p.id === id) || null, error: null }; } }; } }; },
        async insert(l) {
          if (perfis.some((p) => p.nome_usuario.toLowerCase() === l.nome_usuario.toLowerCase())) return { error: { code: "23505" } };
          perfis.push(l); return { error: null };
        }
      };
    },
    storage: { from() { return {
      async upload(caminho, arq) { arquivos[caminho] = URL.createObjectURL(arq); return { error: null }; },
      getPublicUrl(caminho) { return { data: { publicUrl: arquivos[caminho] } }; }
    }; } }
  };
}

const sb = DEMO ? clienteDemo() : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
if (DEMO) $("aviso-demo").hidden = false;

const NOMES_TELA = { "tela-inicio": "FEED", "tela-adicionar": "ADICIONAR" };
function mostrar(id) {
  TELAS.forEach((t) => ($(t).hidden = t !== id));
  $("topo").hidden = !NOMES_TELA[id];
  if (NOMES_TELA[id]) $("topo-nome").textContent = NOMES_TELA[id];
  $("fab-add").hidden = id !== "tela-inicio";
  fecharMenu(); pararPrevia(); window.scrollTo(0, 0);
  if (id === "tela-inicio") abrirFeed();
}
function erro(id, texto) { const e = $(id); e.textContent = texto || ""; e.hidden = !texto; }

// Traduz as mensagens do Supabase para o português.
// Quando não reconhece o erro, mostra o texto original entre parênteses
// (e também no Console do navegador), para dar para descobrir o motivo.
function traduzir(err) {
  console.error("Erro do Supabase:", err);
  const original = (err && (err.message || err.code)) || "";
  const m = original.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já tem conta. Tente entrar.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("easily guessable")) return "Essa senha é fraca demais. Escolha outra.";
  if (m.includes("password") && m.includes("least")) return "A senha é curta demais.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas ou muitos e-mails enviados. Espere um pouco e tente de novo.";
  if (m.includes("not authorized")) return "Este e-mail não pode receber a confirmação agora (limite do e-mail padrão do Supabase).";
  if (m.includes("signups not allowed") || m.includes("signup is disabled") || m.includes("signups are disabled") || m.includes("provider is disabled"))
    return "Os cadastros estão desligados no Supabase (Authentication > Sign In / Providers).";
  if (m.includes("api key") || m.includes("secret api key") || m.includes("invalid jwt"))
    return "A chave do Supabase no config.js não é aceita. Use a chave publishable (sb_publishable_...), nunca a secret.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Confira a URL no config.js.";
  return "Algo deu errado" + (original ? " (" + original + ")" : "") + ". Tente de novo.";
}
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Descobre em qual tela a pessoa deve estar.
async function rotear() {
  const { data } = await sb.auth.getSession();
  const sessao = data && data.session;
  if (!sessao) return mostrar("tela-entrar");
  const { data: perfil } = await sb.from("perfis").select("*").eq("id", sessao.user.id).maybeSingle();
  if (!perfil) return mostrar("tela-perfil");
  eu.id = sessao.user.id; eu.perfil = perfil;
  mostrar("tela-inicio");
}

function ocupado(botao, sim) { botao.disabled = sim; }

$("ir-cadastro").onclick = () => { erro("erro-cadastro"); $("ok-cadastro").hidden = true; mostrar("tela-cadastro"); };
$("voltar-entrar").onclick = () => mostrar("tela-entrar");

$("form-entrar").onsubmit = async (ev) => {
  ev.preventDefault(); erro("erro-entrar");
  const email = $("entrar-email").value.trim(), senha = $("entrar-senha").value;
  if (!emailOk(email) || !senha) return erro("erro-entrar", "Preencha e-mail e senha.");
  const b = ev.submitter; ocupado(b, true);
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  ocupado(b, false);
  if (error) return erro("erro-entrar", traduzir(error));
  $("entrar-senha").value = ""; rotear();
};

$("form-cadastro").onsubmit = async (ev) => {
  ev.preventDefault(); erro("erro-cadastro"); $("ok-cadastro").hidden = true;
  const email = $("cad-email").value.trim(), senha = $("cad-senha").value;
  if (!emailOk(email)) return erro("erro-cadastro", "Digite um e-mail válido.");
  if (senha.length < 8) return erro("erro-cadastro", "A senha precisa ter pelo menos 8 caracteres.");
  if (!$("cad-idade").checked) return erro("erro-cadastro", "A rede é só para maiores de 18 anos.");
  const b = ev.submitter; ocupado(b, true);
  const { data, error } = await sb.auth.signUp({ email, password: senha });
  ocupado(b, false);
  if (error) return erro("erro-cadastro", traduzir(error));
  $("cad-senha").value = "";
  if (data.session) return rotear();           // confirmação por e-mail desligada
  const ok = $("ok-cadastro");                 // confirmação por e-mail ligada
  ok.textContent = "Enviamos um e-mail de confirmação. Confirme e depois entre.";
  ok.hidden = false;
};

// Prévia das imagens escolhidas.
const LIMITES = { "arq-foto": 2 * 1024 * 1024, "arq-banner": 4 * 1024 * 1024 };
function previa(idArquivo, idAlvo) {
  $(idArquivo).onchange = () => {
    const arq = $(idArquivo).files[0]; erro("erro-perfil");
    if (!arq) return;
    if (arq.size > LIMITES[idArquivo]) { $(idArquivo).value = ""; return erro("erro-perfil", `Imagem grande demais (máximo ${LIMITES[idArquivo] / 1048576} MB).`); }
    const alvo = $(idAlvo); alvo.style.backgroundImage = `url("${URL.createObjectURL(arq)}")`;
    if (idAlvo === "previa-foto") alvo.textContent = "";
  };
}
previa("arq-foto", "previa-foto"); previa("arq-banner", "previa-banner");

async function enviarImagem(balde, uid, arquivo, nome) {
  if (!arquivo) return null;
  const ext = ({ "image/png": "png", "image/webp": "webp" })[arquivo.type] || "jpg";
  const caminho = `${uid}/${nome}.${ext}`;          // cada pessoa só grava na própria pasta
  const { error } = await sb.storage.from(balde).upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
  if (error) throw error;
  return sb.storage.from(balde).getPublicUrl(caminho).data.publicUrl;
}

$("form-perfil").onsubmit = async (ev) => {
  ev.preventDefault(); erro("erro-perfil");
  const nome = $("perfil-nome").value.trim(), bio = $("perfil-bio").value.trim();
  if (!/^[A-Za-z0-9_.]{3,20}$/.test(nome)) return erro("erro-perfil", "Nome de usuário: 3 a 20 caracteres, só letras, números, _ e ponto.");
  const b = ev.submitter; ocupado(b, true);
  try {
    const { data } = await sb.auth.getSession();
    const uid = data.session.user.id;
    const foto_url = await enviarImagem("fotos-perfil", uid, $("arq-foto").files[0], "foto");
    const banner_url = await enviarImagem("banners", uid, $("arq-banner").files[0], "banner");
    const { error } = await sb.from("perfis").insert({ id: uid, nome_usuario: nome, bio: bio || null, foto_url, banner_url });
    if (error) {
      if (error.code === "23505") throw new Error("Esse nome de usuário já está em uso.");
      throw new Error(traduzir(error));
    }
    rotear();
  } catch (e) {
    erro("erro-perfil", e.message && /usuário|Imagem/.test(e.message) ? e.message : "Não foi possível salvar o perfil. Tente de novo.");
  }
  ocupado(b, false);
};

// =====================================================================
// MENU DO TOPO
// =====================================================================
function fecharMenu() { $("menu").hidden = true; $("topo-titulo").setAttribute("aria-expanded", "false"); }
$("topo-titulo").onclick = () => {
  const abrir = $("menu").hidden; $("menu").hidden = !abrir;
  $("topo-titulo").setAttribute("aria-expanded", String(abrir));
};
function ir(destino) {
  if (destino === "adicionar") { iniciarAdicionar(); mostrar("tela-adicionar"); }
  else mostrar("tela-inicio");
}
document.querySelectorAll("#menu [data-ir]").forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
$("menu-sair").onclick = async () => { fecharMenu(); await sb.auth.signOut(); };
document.addEventListener("click", (e) => { if (!$("topo").contains(e.target)) fecharMenu(); });

// =====================================================================
// CHAMADAS AO BACKEND (busca no Deezer e cadastro da música)
// =====================================================================
const MUSICAS_DEMO = [
  { deezer_id: "1", titulo: "Aerodynamic", artista: "Daft Punk", album: "Discovery", capa_url: null, explicita: false, previa_url: "https://exemplo.test/previa.mp3" },
  { deezer_id: "2", titulo: "Something About Us", artista: "Daft Punk", album: "Discovery", capa_url: null, explicita: false, previa_url: null },
  { deezer_id: "3", titulo: "Eu Ouço Vozes", artista: "Artista Exemplo", album: "Álbum Exemplo", capa_url: null, explicita: true, previa_url: "https://exemplo.test/previa2.mp3" }
];
async function chamarApi(caminho, opc = {}) {
  if (DEMO) {                                   // sem servidor: respostas de mentira
    if (caminho.startsWith("/api/buscar")) return { resultados: MUSICAS_DEMO };
    if (caminho === "/api/musicas") return { musica: { id: "demo-musica-" + opc.body.deezer_id } };
  }
  const { data } = await sb.auth.getSession();
  const token = data.session && data.session.access_token;
  const resp = await fetch(API_URL + caminho, {
    method: opc.method || "GET",
    headers: { Authorization: "Bearer " + token, ...(opc.body ? { "Content-Type": "application/json" } : {}) },
    body: opc.body ? JSON.stringify(opc.body) : undefined
  });
  let json = null; try { json = await resp.json(); } catch (_) {}
  if (!resp.ok) throw new Error((json && json.erro) || `Servidor indisponível (erro ${resp.status}).`);
  return json;
}
const semConexao = (e) => /failed to fetch|networkerror|load failed/i.test(e.message || "");

// =====================================================================
// ADICIONAR AVALIAÇÃO
// =====================================================================
const add = { musica: null, nota: 0, notaTocada: false, cores: [null, null, null] };
const seletores = [];
const COR_NEUTRA = "#cccccc";

// --- prévia de 30 s (um áudio por vez) ---
let audioAtual = null, botaoAtual = null;
function pararPrevia() {
  if (audioAtual) audioAtual.pause();
  if (botaoAtual) botaoAtual.textContent = "▶";
  audioAtual = null; botaoAtual = null;
}
function tocarPrevia(url, botao) {
  const mesmo = botaoAtual === botao; pararPrevia(); if (mesmo) return;
  audioAtual = new Audio(url); botaoAtual = botao; botao.textContent = "❚❚";
  audioAtual.onended = pararPrevia;
  const falhou = () => { if (botaoAtual === botao) { pararPrevia(); erro("erro-adicionar", "Não foi possível tocar a prévia."); } };
  audioAtual.onerror = falhou;
  const p = audioAtual.play(); if (p && p.catch) p.catch(falhou);
}

// --- uma linha de música (usada na lista e na música escolhida) ---
function linhaMusica(m, { escolhida = false } = {}) {
  const li = document.createElement("div"); li.className = "res" + (escolhida ? " sel" : "");
  const capa = document.createElement("div"); capa.className = "capa-mini";
  if (m.capa_url && /^https:\/\//.test(m.capa_url)) capa.style.backgroundImage = `url("${m.capa_url}")`; else capa.textContent = "♪";
  const info = document.createElement("div"); info.className = "info";
  const t = document.createElement("b"); t.textContent = m.titulo;
  if (m.explicita) { const e = document.createElement("span"); e.className = "selo-e"; e.textContent = "E"; t.append(e); }
  const s = document.createElement("small"); s.textContent = [m.artista, m.album].filter(Boolean).join(" · ");
  info.append(t, s); li.append(capa, info);
  if (m.previa_url && /^https:\/\//.test(m.previa_url)) {
    const b = document.createElement("button"); b.type = "button"; b.className = "play"; b.textContent = "▶";
    b.setAttribute("aria-label", "Tocar prévia de 30 segundos");
    b.onclick = (ev) => { ev.stopPropagation(); tocarPrevia(m.previa_url, b); };
    li.append(b);
  }
  return li;
}

// --- busca ---
async function buscarMusicas() {
  const q = $("busca-q").value.trim(); erro("erro-adicionar");
  if (q.length < 2) return mostrarAviso("Digite pelo menos 2 letras.");
  const lista = $("resultados"); lista.textContent = "Buscando...";
  const demora = setTimeout(() => mostrarAviso("O servidor pode estar acordando: na primeira busca isso leva até 1 minuto."), 6000);
  $("busca-ir").disabled = true;
  try {
    const { resultados } = await chamarApi("/api/buscar?q=" + encodeURIComponent(q));
    lista.textContent = ""; mostrarAviso("");
    if (!resultados.length) return mostrarAviso("Nenhuma música encontrada.");
    resultados.forEach((m) => { const li = linhaMusica(m); li.onclick = () => escolherMusica(m); lista.append(li); });
  } catch (e) {
    lista.textContent = "";
    mostrarAviso(semConexao(e) ? "Não consegui falar com o servidor. Tente de novo em instantes." : e.message);
  }
  clearTimeout(demora); $("busca-ir").disabled = false;
}
function mostrarAviso(t) { const a = $("busca-aviso"); a.textContent = t; a.hidden = !t; }
$("busca-ir").onclick = buscarMusicas;
$("busca-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); buscarMusicas(); } });

function escolherMusica(m) {
  pararPrevia(); add.musica = m; mostrarAviso("");
  const lista = $("resultados"); lista.textContent = "";
  lista.append(linhaMusica(m, { escolhida: true }));
  const trocar = document.createElement("button"); trocar.type = "button"; trocar.className = "trocar"; trocar.textContent = "Trocar música";
  trocar.onclick = () => { add.musica = null; lista.textContent = ""; $("busca-q").focus(); validarAdicionar(); };
  lista.append(trocar); validarAdicionar();
}

// --- as 3 cores (Pickr; se não carregar, usa o seletor do navegador) ---
function criarSeletorCor(idElemento, i) {
  const definir = (hex) => { add.cores[i] = hex; validarAdicionar(); };
  if (window.Pickr) {
    const p = Pickr.create({
      el: "#" + idElemento, theme: "classic", default: COR_NEUTRA, swatches: [],
      components: { preview: true, opacity: false, hue: true, interaction: { hex: true, input: true, save: true } }
    });
    p.on("change", (c) => definir(c.toHEXA().toString()));
    p.on("save", (c) => { definir(c.toHEXA().toString()); p.hide(); });
    p.on("hide", () => { if (add.cores[i] && typeof p.applyColor === "function") p.applyColor(true); });
    seletores[i] = { zerar() { try { p.setColor(COR_NEUTRA, true); p.applyColor(true); } catch (_) {} } };
  } else {
    const inp = document.createElement("input"); inp.type = "color"; inp.value = COR_NEUTRA;
    inp.setAttribute("aria-label", "Cor " + (i + 1));
    inp.oninput = () => definir(inp.value);
    $(idElemento).append(inp);
    seletores[i] = { zerar() { inp.value = COR_NEUTRA; } };
  }
}
["cor-a", "cor-b", "cor-c"].forEach(criarSeletorCor);

// --- nota com meias estrelas ---
const ESTRELA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.8 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L1.7 9.5l7.4-.6z"/></svg>';
function desenharEstrelas() {
  const el = $("estrelas"); el.textContent = "";
  for (let i = 0; i < 5; i++) {
    const f = Math.max(0, Math.min(1, add.nota - i)), s = document.createElement("span");
    s.className = "star"; s.innerHTML = ESTRELA + `<span class="fill" style="width:${f * 100}%">${ESTRELA}</span>`; el.append(s);
  }
  el.setAttribute("aria-valuenow", add.nota);
  $("nota-valor").innerHTML = add.notaTocada ? `${String(add.nota).replace(".", ",")} <small>/ 5</small>` : "<small>Toque ou arraste nas estrelas</small>";
}
function definirNota(v) { add.nota = Math.max(0, Math.min(5, Math.round(v * 2) / 2)); add.notaTocada = true; desenharEstrelas(); validarAdicionar(); }
let arrastando = false;
const notaDoX = (x) => { const r = $("estrelas").getBoundingClientRect(); definirNota(Math.ceil(((x - r.left) / r.width) * 10) / 2); };
$("estrelas").addEventListener("pointerdown", (e) => { arrastando = true; $("estrelas").setPointerCapture(e.pointerId); notaDoX(e.clientX); });
$("estrelas").addEventListener("pointermove", (e) => { if (arrastando) notaDoX(e.clientX); });
["pointerup", "pointercancel"].forEach((ev) => $("estrelas").addEventListener(ev, () => (arrastando = false)));
$("estrelas").addEventListener("keydown", (e) => {
  const k = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key];
  if (k) { e.preventDefault(); definirNota(add.nota + k); }
});

// --- validação, reinício e envio ---
const mesmaCor = (a, b) => a.slice(0, 7).toLowerCase() === b.slice(0, 7).toLowerCase();
function validarAdicionar() {
  const c = add.cores, faltam = c.filter((x) => !x).length;
  const repetida = !faltam && (mesmaCor(c[0], c[1]) || mesmaCor(c[0], c[2]) || mesmaCor(c[1], c[2]));
  $("dica-cores").textContent = repetida ? "As 3 cores precisam ser diferentes." : faltam === 3 ? "Toque em cada quadrado para escolher uma cor." : faltam ? `Faltam ${faltam} cor(es).` : "";
  let falta = "";
  if (!add.musica) falta = "Escolha uma música.";
  else if (faltam || repetida) falta = "Escolha 3 cores diferentes.";
  else if (!add.notaTocada) falta = "Dê uma nota.";
  $("dica-envio").textContent = falta; $("enviar-av").disabled = !!falta;
}
function iniciarAdicionar() {
  Object.assign(add, { musica: null, nota: 0, notaTocada: false, cores: [null, null, null] });
  $("busca-q").value = ""; $("resultados").textContent = ""; mostrarAviso(""); $("critica").value = ""; erro("erro-adicionar");
  seletores.forEach((s) => s.zerar()); desenharEstrelas(); validarAdicionar();
}
$("cancelar-av").onclick = () => ir("inicio");

$("enviar-av").onclick = async () => {
  erro("erro-adicionar"); validarAdicionar(); if ($("enviar-av").disabled) return;
  const botao = $("enviar-av"); botao.disabled = true; pararPrevia();
  try {
    const { musica } = await chamarApi("/api/musicas", { method: "POST", body: { deezer_id: add.musica.deezer_id } });
    const [cor1, cor2, cor3] = add.cores;
    const { data, error } = await sb.from("avaliacoes")
      .insert({ musica_id: musica.id, nota: add.nota, critica: $("critica").value.trim() || null, cor1, cor2, cor3 })
      .select().single();
    if (error) throw error;
    const aviso = $("aviso-inicio"); aviso.hidden = false;
    aviso.textContent = "Avaliação publicada!" + (data.eh_primeira_da_musica ? " Você foi a primeira pessoa a avaliar esta música (#1)." : "") + (data.eh_reavaliacao ? " Re-avaliação registrada." : "");
    aba = "global";                              // volta ao feed Global para a pessoa ver a avaliação nova
    mostrar("tela-inicio");
  } catch (e) {
    erro("erro-adicionar", semConexao(e) ? "Não consegui falar com o servidor. Tente de novo em instantes."
      : e.code === "23514" ? "Confira a nota e as cores: algo está fora do permitido."
      : (e.message && !e.code) ? e.message : traduzir(e));
    validarAdicionar();
  }
};


// =====================================================================
// FEED (abas Global, Seguidos e HIT)
// =====================================================================
const ABA_PADRAO = "global";            // quando houver bastante gente, troque para "hit"
const TAM_PAGINA = 20;
const eu = { id: null, perfil: null };
const SELECT_AV = "id,nota,critica,cor1,cor2,cor3,eh_reavaliacao,eh_primeira_da_musica,criado_em,usuario_id," +
  "perfis(nome_usuario,foto_url),musicas(titulo,artista,album,capa_url,explicita)";

// ---- acesso aos dados (no modo demonstração usa a lista de exemplo) ----
async function completar(linhas) {
  if (!linhas.length) return [];
  const ids = linhas.map((l) => l.id);
  const [pl, re] = await Promise.all([
    sb.from("avaliacoes_placar").select("avaliacao_id,pontuacao").in("avaliacao_id", ids),
    sb.from("reacoes").select("avaliacao_id,tipo").in("avaliacao_id", ids)   // só as minhas (regra do banco)
  ]);
  const placar = Object.fromEntries((pl.data || []).map((x) => [x.avaliacao_id, x.pontuacao]));
  const minhas = Object.fromEntries((re.data || []).map((x) => [x.avaliacao_id, x.tipo]));
  return linhas.map((l) => ({
    id: l.id, nota: Number(l.nota), critica: l.critica, cores: [l.cor1, l.cor2, l.cor3],
    reavaliacao: l.eh_reavaliacao, primeira: l.eh_primeira_da_musica, criado_em: l.criado_em, usuario_id: l.usuario_id,
    autor: l.perfis || {}, musica: l.musicas || {}, pontuacao: placar[l.id] || 0, minha: minhas[l.id] || null
  }));
}
const dados = DEMO ? {
  async global(antes) { const lista = AVALIACOES_DEMO.filter((a) => !antes || a.criado_em < antes).map((a) => ({ ...a, autor: a.autor || eu.perfil })); return { itens: lista.slice(0, TAM_PAGINA), mais: false }; },
  async seguidos() { return { itens: [], mais: false }; },
  async hit() { return { itens: AVALIACOES_DEMO.filter((a) => a.pontuacao > 0).sort((a, b) => b.pontuacao - a.pontuacao).map((a) => ({ ...a, autor: a.autor || eu.perfil, hit: true })), mais: false }; },
  async reagir(av, tipo) {
    const original = AVALIACOES_DEMO.find((a) => a.id === av.id), antes = av.minha;
    const nova = antes === tipo ? null : tipo;
    const delta = (nova === "curtir" ? 1 : nova === "discordar" ? -1 : 0) - (antes === "curtir" ? 1 : antes === "discordar" ? -1 : 0);
    original.pontuacao = Math.max(0, original.pontuacao + delta); original.minha = nova;
    return { minha: nova, pontuacao: original.pontuacao };
  },
  async apagar(id) { AVALIACOES_DEMO.splice(AVALIACOES_DEMO.findIndex((a) => a.id === id), 1); }
} : {
  async global(antes) {
    let q = sb.from("avaliacoes").select(SELECT_AV).order("criado_em", { ascending: false }).limit(TAM_PAGINA);
    if (antes) q = q.lt("criado_em", antes);
    const { data, error } = await q; if (error) throw error;
    return { itens: await completar(data), mais: data.length === TAM_PAGINA };
  },
  async seguidos(antes) {
    const { data: seg, error } = await sb.rpc("feed_seguidos", { p_limite: TAM_PAGINA, p_antes: antes || null });
    if (error) throw error;
    if (!seg.length) return { itens: [], mais: false };
    const { data, error: e2 } = await sb.from("avaliacoes").select(SELECT_AV).in("id", seg.map((x) => x.id)).order("criado_em", { ascending: false });
    if (e2) throw e2;
    return { itens: await completar(data), mais: seg.length === TAM_PAGINA };
  },
  async hit() {
    const { data: h, error } = await sb.rpc("hit", { p_limite: 50 });
    if (error) throw error;
    if (!h.length) return { itens: [], mais: false };
    const { data, error: e2 } = await sb.from("avaliacoes").select(SELECT_AV).in("id", h.map((x) => x.avaliacao_id));
    if (e2) throw e2;
    const ordem = Object.fromEntries(h.map((x, i) => [x.avaliacao_id, i]));
    const itens = (await completar(data)).sort((a, b) => ordem[a.id] - ordem[b.id]);
    itens.forEach((a) => { a.hit = true; });
    return { itens, mais: false };
  },
  async reagir(av, tipo) {                       // clicar de novo no mesmo botão tira a reação
    const r = av.minha === tipo
      ? await sb.rpc("remover_reacao", { p_avaliacao_id: av.id })
      : await sb.rpc("reagir", { p_tipo: tipo, p_avaliacao_id: av.id });
    if (r.error) throw r.error;
    const { data } = await sb.from("avaliacoes_placar").select("pontuacao").eq("avaliacao_id", av.id).maybeSingle();
    return { minha: av.minha === tipo ? null : tipo, pontuacao: data ? data.pontuacao : 0 };
  },
  async apagar(id) { const { error } = await sb.from("avaliacoes").delete().eq("id", id); if (error) throw error; }
};

// ---- desenho do cartão ----
function tempoRelativo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return Math.floor(s / 60) + "min";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 7 * 86400) return Math.floor(s / 86400) + " d";
  if (s < 30 * 86400) return Math.floor(s / (7 * 86400)) + " sem";
  return new Date(iso).toLocaleDateString("pt-BR");
}
const corOk = (c) => /^#[0-9A-Fa-f]{6}$/.test(c || "") ? c : "#CCCCCC";
function fundoHalo(cores) {
  const [a, b, c] = cores.map(corOk);
  return `radial-gradient(circle at 12% 55%, ${a} 0%, transparent 62%), radial-gradient(circle at 92% 10%, ${b} 0%, transparent 58%), radial-gradient(circle at 80% 100%, ${c} 0%, transparent 58%)`;
}
function estrelasLeitura(nota) {
  const el = document.createElement("div"); el.className = "estrelas-leitura";
  el.setAttribute("role", "img"); el.setAttribute("aria-label", "Nota " + String(nota).replace(".", ",") + " de 5");
  for (let i = 0; i < 5; i++) {
    const f = Math.max(0, Math.min(1, nota - i)), s = document.createElement("span");
    s.className = "star"; s.innerHTML = ESTRELA + `<span class="fill" style="width:${f * 100}%">${ESTRELA}</span>`; el.append(s);
  }
  return el;
}
function elemento(tag, classe, texto) { const e = document.createElement(tag); if (classe) e.className = classe; if (texto != null) e.textContent = texto; return e; }

function cartao(av) {
  const item = elemento("div", "item");
  const tags = [[av.hit, "hit", "HIT"], [av.primeira, "primeira", "#1 Avaliação"], [av.reavaliacao, "reav", "Re-avaliação"]];
  tags.filter((t) => t[0]).forEach((t) => item.append(elemento("span", "tag " + t[1], t[2])));

  const caixa = elemento("article", "av"), corpo = elemento("div", "corpo");
  const autor = elemento("div", "autor"), avatar = elemento("div", "avatar");
  const nome = (av.autor && av.autor.nome_usuario) || "alguém";
  if (av.autor && /^https:\/\//.test(av.autor.foto_url || "")) avatar.style.backgroundImage = `url("${av.autor.foto_url}")`; else avatar.textContent = nome[0].toUpperCase();
  autor.append(avatar, elemento("span", "nome", "@" + nome));

  const m = av.musica || {};
  const titulo = elemento("h3", "", m.titulo || "Música");
  if (m.explicita) titulo.append(elemento("span", "selo-e", "E"));
  corpo.append(autor, titulo, elemento("p", "sub2", [m.artista, m.album].filter(Boolean).join(" – ")));
  if (av.critica) corpo.append(elemento("p", "texto", av.critica));
  corpo.append(estrelasLeitura(av.nota));

  const acoes = elemento("div", "acoes");
  const curtir = elemento("button", "pill curtir"), discordar = elemento("button", "pill discordar");
  curtir.type = discordar.type = "button";
  curtir.innerHTML = '<span class="icone i-estrela"></span><span class="n"></span>';
  discordar.innerHTML = '<span class="icone i-discordar"></span>';
  curtir.setAttribute("aria-label", "Curtir"); discordar.setAttribute("aria-label", "Discordar");
  const pintar = () => {
    curtir.querySelector(".n").textContent = av.pontuacao;
    curtir.setAttribute("aria-pressed", String(av.minha === "curtir")); discordar.setAttribute("aria-pressed", String(av.minha === "discordar"));
  };
  const reagir = async (tipo, botao) => {
    botao.classList.add("ocupado");
    try { const r = await dados.reagir(av, tipo); av.minha = r.minha; av.pontuacao = r.pontuacao; pintar(); }
    catch (e) { console.error(e); avisoFeed("Não foi possível registrar sua reação agora."); }
    botao.classList.remove("ocupado");
  };
  curtir.onclick = () => reagir("curtir", curtir); discordar.onclick = () => reagir("discordar", discordar);
  pintar();
  acoes.append(curtir, discordar);
  if (av.usuario_id === eu.id) {
    const ap = elemento("button", "apagar", "Apagar"); ap.type = "button";
    ap.onclick = async () => {
      if (!confirm("Apagar esta avaliação? Os comentários dela também serão apagados.")) return;
      try { await dados.apagar(av.id); item.remove(); if (!$("feed").children.length) avisoFeed(VAZIO[aba]); }
      catch (e) { console.error(e); avisoFeed("Não foi possível apagar agora."); }
    };
    acoes.append(ap);
  }
  acoes.append(elemento("span", "quando", tempoRelativo(av.criado_em)));
  corpo.append(acoes);

  const halo = elemento("div", "halo"); halo.style.backgroundImage = fundoHalo(av.cores);
  const capa = elemento("div", "capa-g");
  if (/^https:\/\//.test(m.capa_url || "")) capa.style.backgroundImage = `url("${m.capa_url}")`; else capa.textContent = "♪";
  halo.append(capa);
  caixa.append(corpo, halo); item.append(caixa);
  return item;
}

// ---- abas e carregamento ----
const VAZIO = {
  global: "Ainda não há avaliações. Seja o primeiro: toque no + para adicionar a sua.",
  seguidos: "Nada por aqui ainda: você não segue ninguém, ou quem você segue ainda não avaliou.",
  hit: "Nenhum destaque nesta janela (de 12h a 12h). Curta uma avaliação para ela aparecer aqui."
};
let aba = ABA_PADRAO, cursor = null, carregando = false;
function avisoFeed(t) { const a = $("feed-aviso"); a.textContent = t; a.hidden = !t; }
function marcarAbas() { document.querySelectorAll(".aba").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === aba))); }
async function carregarFeed(reiniciar) {
  if (carregando) return; carregando = true;
  const lista = $("feed");
  if (reiniciar) { lista.textContent = ""; cursor = null; $("feed-mais").hidden = true; }
  avisoFeed("Carregando...");
  const minhaAba = aba;
  try {
    const { itens, mais } = await dados[minhaAba](cursor);
    if (minhaAba !== aba) { carregando = false; return; }        // mudou de aba durante o carregamento
    avisoFeed("");
    itens.forEach((a) => lista.append(cartao(a)));
    if (itens.length) cursor = itens[itens.length - 1].criado_em;
    $("feed-mais").hidden = !mais;
    if (!lista.children.length) avisoFeed(VAZIO[aba]);
  } catch (e) {
    console.error("Erro ao carregar o feed:", e);
    avisoFeed("Não foi possível carregar o feed agora. Tente de novo." + (e && e.message ? " (" + e.message + ")" : ""));
  }
  carregando = false;
}
function abrirFeed() { marcarAbas(); carregarFeed(true); }
document.querySelectorAll(".aba").forEach((b) => (b.onclick = () => { if (b.dataset.aba === aba) return; aba = b.dataset.aba; carregando = false; marcarAbas(); carregarFeed(true); }));
$("feed-mais").onclick = () => carregarFeed(false);
$("fab-add").onclick = () => ir("adicionar");

sb.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") mostrar("tela-entrar"); });
rotear();
