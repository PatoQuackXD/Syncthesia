// Syncthesia — entrar, criar conta e criar perfil (Supabase).
const cfg = window.SYNC_CONFIG || {};
const DEMO = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith("COLE");
const $ = (id) => document.getElementById(id);
const TELAS = ["tela-entrar", "tela-cadastro", "tela-perfil", "tela-inicio"];

// Sem config preenchido, roda com um "Supabase de mentira" só para ver as telas.
function clienteDemo() {
  const usuarios = [], perfis = [], ouvintes = [], arquivos = {};
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
    from() {
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

function mostrar(id) { TELAS.forEach((t) => ($(t).hidden = t !== id)); window.scrollTo(0, 0); }
function erro(id, texto) { const e = $(id); e.textContent = texto || ""; e.hidden = !texto; }

// Traduz as mensagens do Supabase para o português.
function traduzir(err) {
  const m = (err && err.message || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Tente entrar.";
  if (m.includes("password") && m.includes("least")) return "A senha é curta demais.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Tente de novo.";
  return "Algo deu errado. Tente de novo.";
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

$("sair").onclick = async () => { await sb.auth.signOut(); };
sb.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") mostrar("tela-entrar"); });
rotear();
