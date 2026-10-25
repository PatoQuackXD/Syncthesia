// Syncthesia — entrar, criar conta e criar perfil (Supabase).
const cfg = window.SYNC_CONFIG || {};
const DEMO = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith("COLE");
const $ = (id) => document.getElementById(id);
const TELAS = ["tela-entrar", "tela-cadastro", "tela-perfil", "tela-inicio", "tela-adicionar"];
const API_URL = (cfg.API_URL || "https://meu-backend-jf73.onrender.com").replace(/\/$/, "");

// Sem config preenchido, roda com um "Supabase de mentira" só para ver as telas.
function clienteDemo() {
  const usuarios = [], perfis = [], avaliacoes = [], ouvintes = [], arquivos = {};
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
        avaliacoes.push(linha); return { data: linha, error: null };
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
  fecharMenu(); pararPrevia(); window.scrollTo(0, 0);
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
  $("eu-nome").textContent = "@" + perfil.nome_usuario;
  $("eu-bio").textContent = perfil.bio || "";
  const foto = $("eu-foto");
  foto.style.backgroundImage = perfil.foto_url ? `url("${perfil.foto_url}")` : "";
  foto.textContent = perfil.foto_url ? "" : perfil.nome_usuario[0].toUpperCase();
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
$("ir-adicionar").onclick = () => ir("adicionar");
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
    mostrar("tela-inicio");
  } catch (e) {
    erro("erro-adicionar", semConexao(e) ? "Não consegui falar com o servidor. Tente de novo em instantes."
      : e.code === "23514" ? "Confira a nota e as cores: algo está fora do permitido."
      : (e.message && !e.code) ? e.message : traduzir(e));
    validarAdicionar();
  }
};

sb.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") mostrar("tela-entrar"); });
rotear();
